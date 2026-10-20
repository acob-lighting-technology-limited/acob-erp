# Matrix documentation

| Folder | What lives here |
|---|---|
| [`guides/`](guides/) | How to use Matrix — the staff [user guide](guides/user-guide.md). |
| [`architecture/`](architecture/) | How the modules connect — [module flow diagrams](architecture/module-flow-diagrams.html) ([PDF](architecture/module-flow-diagrams.pdf)). |
| [`integrations/`](integrations/) | External systems: the [Hikvision attendance terminal](integrations/hikvision.md) and [Teams meeting artifact sync](integrations/meeting-artifacts-sync.md). |
| [`runbooks/`](runbooks/) | Step-by-step operational procedures: [rotating Supabase keys](runbooks/security-key-rotation.md), [database recovery](runbooks/db-recovery/). |
| [`audit/`](audit/) | The [current full-repo audit](audit/2026-10-01-full-repo-critique.md) with its remediation checklist, and earlier reports in [`history/`](audit/history/). |

Engineering rules for contributors (human or AI) are in [`AGENTS.md`](../AGENTS.md) at the repo root.

What does **not** belong here: AI prompts, "completion summaries", or business documents
(memos, inventories, proposals) — those go in SharePoint.
