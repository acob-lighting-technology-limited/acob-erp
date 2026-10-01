# Archived SQL

Files here are **not** migrations and are never applied by `supabase db push`.

- `migrations_backup/` — pre-baseline migration history, superseded by
  `supabase/migrations/001–006_remote_baseline.sql`. Kept for reference only.
- `_fix_queue_secret.sql` — one-off hand fix that was sitting in `migrations/`
  without a timestamp. It contains a webhook secret that must be rotated
  (audit finding A9); the rotated value belongs in Vault, not in SQL.
