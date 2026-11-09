# Prompt: update the UI ratchet

Paste everything below the line into the agent.

---

You are working in the ACOB ERP repo (Next.js + Supabase). Read `AGENTS.md` in full first; every rule in it
is mandatory. The section that matters here is "UI guard — audit and ratchet". The ratchet lives in
`scripts/ui/ratchet.mjs` (runner), `scripts/ui/ratchet-rules.mjs` (rules),
`scripts/ui/ratchet-baseline.json` (committed per-file counts) and `scripts/ui/__tests__/ratchet.test.mjs`.

## Setup

- Create a new branch from `origin/main`: `git fetch origin && git switch -c chore/ratchet-update origin/main`.
  If tracked files have uncommitted changes (`git status --short --untracked-files=no` prints anything),
  stop and tell the user. Do not stash or discard them. Untracked files such as `docs/scorecard/*.xlsx`
  are the user's and are not part of this task: leave them and never stage them.
- Do not run `npm run build`. Verify with the commands under "Checks".
- Do not use `--no-verify`. Do not add a `Co-Authored-By` trailer or any "Generated with" footer.

## 1. Make the pre-push check judge the pushed commit, not the working tree

Today `.husky/pre-push` runs `npm run ui:guard`, which reads the working tree. Unrelated uncommitted work on
the checked-out branch then blocks a clean push.

- Change the UI guard step in `.husky/pre-push` to read the refs git passes on stdin
  (`<local ref> <local sha> <remote ref> <remote sha>` per line). For each local sha that is not all zeros:
  export that commit's tree to a temp dir (`git archive <sha> | tar -x -C "$tmp"`), then run
  `node scripts/ui/audit-reusables.mjs` and `node scripts/ui/ratchet.mjs` with that dir as the cwd. Fail
  the push if either fails. Remove the temp dir afterwards, including on failure.
- Leave the `lint:strict` and `type-check` steps as they are.
- Keep the protected-branch check at the top of the hook.
- The hook runs in Git Bash on Windows and in sh on Linux. Use POSIX sh only.
- Update the "UI guard" section of `AGENTS.md` and `scripts/ui/README.md` to say the hook checks the pushed
  commit.

## 2. Report `file-lines` in lines, apart from violation counts

`file-lines` counts a file's length, so its numbers swamp the "N fewer violations" total. In `ratchet.mjs`,
leave `file-lines` out of the success-line total and print its change on its own line, for example
`file-lines: 379 fewer lines in files over 1,000 lines`. The check logic itself does not change.

## 3. Move three zero-count rules to ESLint

Each of these is at zero today. ESLint flags them in the editor, which the ratchet cannot.

| Ratchet rule | ESLint rule(s) to turn on as `"error"` in `eslint.config.mjs` |
|---|---|
| `window-dialogs` | `no-alert` |
| `key-index` | `react/no-array-index-key` |
| `click-div` | `jsx-a11y/click-events-have-key-events`, `jsx-a11y/no-static-element-interactions` |

For each one:

1. Turn the ESLint rule on, then run `npx eslint . --ext .js,.jsx,.ts,.tsx --rule '<rule>: error' -f unix | wc -l`
   (or just `npm run lint:strict`) to count existing violations.
2. **If ESLint reports zero:** keep the ESLint rule, remove the ratchet rule from `RULES`, `HINTS`, the
   tests and the `AGENTS.md` table, and drop its key from the baseline.
3. **If ESLint reports any:** do not turn the ESLint rule on. Keep the ratchet rule and report the count.
   For `click-div` this is likely: the current regex `<div\b[^>\n]*\sonClick=` misses `onClick` on a
   later line, so its zero may be false. In that case, fix the regex to match across lines up to the
   tag's closing `>` (keep the existing `stopPropagation` exemption and test it), then regenerate the
   baseline for that rule only (see step 5).

`eslint-config-next` already loads the `react` and `jsx-a11y` plugins. Confirm that before relying on it.

## 4. Add four rules

Add each to `RULES` and `HINTS` in `ratchet-rules.mjs`, with tests in `__tests__/ratchet.test.mjs` for
what it counts and what it must ignore, and a row in the `AGENTS.md` table. Each comes from an existing
`AGENTS.md` rule; quote it in the hint.

| id | applies to | counts | hint |
|---|---|---|---|
| `api-error-message` | `app/api/**` | `NextResponse.json({ error: <ident>.message` where the identifier is `error`, `err` or ends in `Error`, optional `?.` | "Never return `error.message` to the client. Log it with the logger; return a generic message." |
| `route-without-zod` | files named `route.ts` under `app/api/` | 1 if the file calls `request.json()` or `req.json()` and imports nothing from `zod` and has no `z.object` | "Validate the body with zod." |
| `local-number-format` | `app/`, `components/`, `hooks/` (not `lib/utils/`) | `new Intl.NumberFormat` | "Use the shared formatters in `@/lib/utils`; no local copies of shared helpers." |
| `hand-h1` | `app/**`, except files the UI audit allowlist marks as standalone public pages | `<h1\b` | "The title comes from `PageHeader`. Do not hand-write an `<h1>`." |

Expected counts on today's `main`, as a sanity check: `api-error-message` about 7 in 6 files,
`route-without-zod` about 31 files, `local-number-format` about 7 files, `hand-h1` about 6 files. If yours
differ a lot, the regex is wrong; fix it before going on.

Do not fix the existing violations in this change. The baseline records them.

## 5. Regenerate the baseline once

After all rule changes, run `node scripts/ui/ratchet.mjs --update --allow-increase`. Then diff
`ratchet-baseline.json` against `origin/main`:

- Only the four new rules, a changed `click-div` (if step 3 changed it) and removed rules may change.
- Every other rule's per-file counts must be identical. If any other count rose, stop: you have broken an
  existing rule.

## Checks

```bash
node --test scripts/ui/__tests__/ratchet.test.mjs
npm run ui:guard
npm run lint:strict
npx tsc --noEmit -p tsconfig.json
```

Also test the hook: make a throwaway commit on a scratch branch that adds a violation (for example a
`select("*")`), and confirm a push dry run is blocked: `git push --dry-run origin <branch>`. Then make the
working tree dirty with a violation that is not committed and confirm a clean commit is not blocked.
Delete the scratch branch afterwards. Never push it.

## Done means

- All checks above pass.
- `ratchet.mjs --summary` lists the rule set described here, and its totals are in the PR description.
- One commit per part (hook, reporting, ESLint moves, new rules plus baseline), message format
  `chore(ui-guard): <what>`, body lines at most 100 characters.
- Push the branch and open one PR against `main`. Do not merge it.
- In the PR description, list for each step in section 3 whether the rule moved to ESLint or stayed, and
  the counts you found.
