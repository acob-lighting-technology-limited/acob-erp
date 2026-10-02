# scripts/

Maintained tooling only. Everything here is wired into `package.json`, CI, or an
operational runbook.

| Script | Purpose | Run with |
|---|---|---|
| `clean-next.mjs` | Clears `.next/` before a production build (used by `npm run build` on Vercel) | automatic |
| `ui/audit-reusables.mjs` | Flags pages that bypass the shared UI components | `npm run ui:audit` |
| `ui/ensure-loading.mjs` | Lists / scaffolds missing route `loading.tsx` skeletons | `npm run ui:ensure-loading` |
| `anon-security-probe.mjs` | Probes the public anon key against tables and RPCs to confirm RLS denies access | `npm run security:anon-probe` |
| `test-campaign/` | Scripted end-to-end campaign against a running app | `npm run test:campaign` |
| `deploy-edge-functions.js` | Deploys every Supabase edge function | `node scripts/deploy-edge-functions.js` |
| `check-migration-status.sh` | Shows local vs remote migration status | `bash scripts/check-migration-status.sh` |

`archive/` holds one-off data fixes, imports and report generators kept for
reference. They are not type-checked or maintained; do not run them against
production without reading them first.
