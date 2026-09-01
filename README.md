# Shared savings PWA — Stage 2 foundation

PWA for shared savings goals. Product behavior is defined by `PRODUCT_SPEC.md`; repository rules are in `AGENTS.md`.

Stage 2 adds the real-data boundary: Supabase PostgreSQL/Auth, server-side sessions, RLS, Google OAuth routes, profiles, shared goals, members, savings, expenses, audit and one-time invitation links. Stage 2.3 adds Realtime refresh for open collaborative goals. The original development-only demo remains available when Supabase variables are empty.

## Requirements

- Windows 11
- Node.js 22+
- npm 10+

## Safe local demo

With Supabase variables empty, development still opens the synthetic demo and does not contact a cloud database.

```powershell
cd P:\Projects\vmeste-app
Copy-Item .env.example .env.local -Force
npm install
npm run dev
```

Open `http://localhost:3000`.

## Enable Stage 2 live mode

Do this only after intentionally creating a Supabase project. Full steps are in `docs/STAGE2_SETUP.md`.

Set these values in `.env.local`:

```dotenv
NEXT_PUBLIC_APP_NAME=Вместе
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Use **only the publishable key** in `NEXT_PUBLIC_*`. Never put `service_role` or another secret key in browser-visible environment variables.

Database migrations are applied in order:

```text
supabase/migrations/202608310001_stage2_core.sql
supabase/migrations/202608310002_fix_invitation_acceptance.sql
supabase/migrations/202608310003_enable_realtime.sql
```

For an existing Stage 2.2 development database, only `202608310003_enable_realtime.sql` is new. See `docs/STAGE2_3_REALTIME.md` for the two-user check.

After the migration and Google provider are configured, restart `npm run dev` and open `http://localhost:3000`. The app will switch from demo mode to Google sign-in automatically.

## Checks

```powershell
npm run lint
npm run typecheck
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

Database tests are under `supabase/tests/database`. Their local setup is documented in `supabase/tests/README.md`.

```powershell
npm run test:db
```

## Stage 2 security model

- Sessions are cookie-based through `@supabase/ssr`.
- Server-side access checks use verified Auth claims.
- RLS is enabled for every application table exposed through the Supabase API.
- Owner/member/non-member permissions are enforced in the database, not only by UI controls.
- Invitation URLs contain a random token; only its SHA-256 hash is stored.
- Invitation creation is a trusted RPC that fixes the lifetime at seven days.
- Accepted invitation tokens are one-time.
- Archived goals are read-only in both UI and database policies/triggers.
- Financial amounts use integer minor units. Read views cast `BIGINT` money to text before it crosses the JavaScript boundary.
- Savings and expenses remain separate domains; expense rows never mutate savings rows or goal progress.
- Stage 3 import tables exist in the schema but are read-only through the API until the atomic import flow is implemented.

## Current structure

```text
src/
  app/                     # App Router, auth callbacks, live pages and Server Actions
  features/demo/           # development-only synthetic prototype
  features/live/           # live Supabase UI types/components
  lib/supabase/            # browser/server/proxy Auth clients and config
  server/goals/            # trusted data-access boundary
supabase/
  migrations/              # ordered database schema + RLS
  tests/database/          # pgTAP/RLS tests
```

## External services and credentials

The repository never contains real Supabase or OAuth secrets. Development and production Supabase/Vercel projects are configured outside Git through environment variables. Google OAuth, PDF/CSV/XLSX import, Realtime and the public Vercel deployment are implemented. Apple OAuth and broader release/security review remain later milestones.

## Stage 3 — PDF/CSV/XLSX import

After applying the Stage 3 update, run migration `supabase/migrations/202608310004_import_commit.sql` in the Supabase SQL Editor, then run `npm install` because this stage adds `read-excel-file` for browser-side XLSX parsing.

Open a goal and choose **Импорт**. The flow is: file → mapping → preview/duplicate check → explicit selection → atomic commit. The original statement is not stored.


## Update 3.0.1

- The import entry point is now a visible `Импортировать PDF/CSV/XLSX` button under the goal section navigation.
- System expense category names are repaired with `202608310005_fix_category_names.sql`. The migration is ASCII-only to avoid Windows PowerShell 5.1 encoding corruption.
- When copying any future UTF-8 SQL file from Windows PowerShell, use `Get-Content -Encoding UTF8 ... -Raw | Set-Clipboard`.

## Stage 4.0 — closed beta preparation

Version `0.4.0` adds the public beta shell without changing the financial schema: a minimal landing page, privacy/terms pages, profile settings with browser-detected timezone, authenticated JSON export, basic error/loading states, no-index metadata and baseline security headers.

No new npm dependency or SQL migration is required for this update. Account deletion, production backup/restore verification, Apple OAuth and final legal/security review remain release blockers before a broad public launch.

## Stage 4.1 — deployment-ready closed beta

Version `0.4.1` prepares the app for a separate HTTPS beta environment. Use `docs/CLOSED_BETA_DEPLOY.md` rather than pointing the public Vercel deployment at the existing development database. The aggregate `supabase/bootstrap/20260831_closed_beta.sql` is for a new empty beta Supabase project only.

Before deployment run:

```powershell
.\scripts\preflight-beta.ps1
```

Closed beta remains `noindex` by default. Invitation URLs derive the active request origin, so production does not need a hard-coded `NEXT_PUBLIC_APP_URL`.

## Git и релизы

После первого стабильного интернет-релиза проект ведётся через Git. Инструкции: `docs/GIT_RELEASE.md`. Roadmap: `docs/ROADMAP.md`.

Контакты поддержки в приложении: Telegram `@kemisayega`, email `ekaterina.pyshkova@gmail.com`.


## Stage 4.3 — language and appearance preferences

Version `0.6.0` adds full RU/EN user-interface switching, six visual themes, three typography presets and prominent developer/support contacts on the landing page and profile. Apply `supabase/migrations/202609010001_profile_preferences.sql` to every existing Supabase environment before deploying this code. The migration only adds `theme_key` and `font_key` profile preferences; it does not modify financial rows.

The first supported goal currencies are KZT, EUR, USD and RUB. Stage 4.3 still uses one currency per goal. Cross-currency savings conversion is intentionally deferred to a separate financial migration and must not be simulated with floating-point arithmetic.

## Multi-currency savings (0.7.0)

Savings transactions may be stored in `KZT`, `EUR`, `USD`, or `RUB` while a goal keeps one reporting currency. The app fetches official National Bank of Kazakhstan daily rates from the documented HTTPS XML service and derives non-KZT cross-rates through KZT. Original transaction amounts are never rewritten when FX rates change.

Before running 0.7.0 against an existing database, apply:

```text
supabase/migrations/202609010002_multicurrency_savings.sql
```

Apply it to both development and production Supabase projects before deploying the code.


### PDF import

Text-based PDF statements are extracted locally with Mozilla PDF.js. The original PDF is not persisted. Image-only/scanned PDFs are deliberately rejected until a privacy-preserving OCR path is added.

## Stage 4.8 — overlapping statement duplicate protection

Before running 0.11.0 against an existing database, apply:

```text
supabase/migrations/202609010004_duplicate_protection.sql
```

Apply it to both development and production Supabase projects before deploying the code.

Duplicate reconciliation is bank-agnostic. Exact file SHA-256 remains the first guard. When a statement exposes a transaction/reference ID it is used automatically; otherwise the importer reconciles date, amount, currency, debit/credit direction and normalized bank description while preserving the number of genuinely identical operations. If an account/IBAN/card scope can be detected, only its SHA-256 hash is sent to and stored by the backend. Unknown banks continue through the generic parser rather than being rejected by bank name.

## Stage 4.9 — app icon

Version `0.12.0` introduces the selected app mark: two connected rounded forms representing a shared goal. The same mark is used in the interface, browser favicon, Apple Touch Icon and installable PWA icons, including a maskable variant. No database migration or new dependency is required.

## Stage 5.0 — accessibility and security hardening

Version `0.13.0` moves primary actions to each theme's dark accent token for WCAG AA contrast, adds a consistent visible keyboard focus ring and strengthens baseline public HTTP headers. E2E startup now binds explicitly to localhost for stable test execution in restricted environments. No database migration or new dependency is required.
