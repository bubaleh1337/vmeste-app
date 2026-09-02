# Encrypted database backups

The production Supabase database is exported automatically every Sunday at
06:00 Kazakhstan time (UTC+5). The workflow can also be started manually from
GitHub Actions.

Only an AES-256 encrypted 7-Zip archive is uploaded to GitHub. Unencrypted SQL
files and database credentials are not committed or uploaded.

## Required GitHub Actions secrets

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`
- `BACKUP_ENCRYPTION_PASSWORD`

Use a unique backup encryption password and keep a copy outside GitHub. Without
this password, the backup cannot be opened or restored.

## Manual verification

1. Open the repository on GitHub.
2. Open **Actions** and select **Encrypted database backup**.
3. Select **Run workflow** and wait for the green check mark.
4. Download the artifact from the completed workflow run.
5. Open the `.7z` file with 7-Zip and enter the backup encryption password.

The archive must contain `schema.sql`, `data.sql`, and `roles.sql`.

Supabase CLI logical dumps exclude Supabase-managed schemas such as `auth` and
`storage`. The application does not store imported statement files in Supabase
Storage. OAuth identities remain managed by Supabase Auth.
