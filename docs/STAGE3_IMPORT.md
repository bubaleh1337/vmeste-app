# Stage 3.0 — CSV/XLSX import

This update implements the first complete safe import vertical slice.

## Security and product rules

- `.csv` and `.xlsx` only.
- File parsing and SHA-256 calculation happen in the browser.
- The original statement is not stored in Supabase.
- Preview is mandatory before commit.
- Probable card/account numbers are masked in preview.
- Exact row duplicates and repeat file uploads are detected before commit and rechecked during commit.
- Commit runs inside one PostgreSQL function, so a critical error rolls the entire import back.
- Imported expenses never modify savings progress.
- Money is normalized to integer minor units before persistence.
- Current temporary safety limits are centralized in `src/features/imports/normalize.ts`: 5 MiB and 1000 data rows. They are implementation guards, not a final product decision.

## Setup

Apply `supabase/migrations/202608310004_import_commit.sql` to the existing development Supabase project.

This release also adds the maintained MIT package `read-excel-file` for browser-side `.xlsx` parsing. Run `npm install` after copying the update.
