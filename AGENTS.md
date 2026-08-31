# Repository instructions

## Product source of truth

- Read `PRODUCT_SPEC.md` before planning or changing product behavior.
- This is a shared savings-goal app, not a bank, investment adviser or accounting ledger.
- Savings and expenses are separate domains. An expense must never change saved balance or goal progress.
- If a request conflicts with `PRODUCT_SPEC.md`, explain the conflict before editing.
- Keep the working product name configurable and never spread it as hard-coded strings.

## Working method

1. Inspect the repository and relevant files before editing.
2. For multi-file or architectural work, write a short plan first.
3. Implement one coherent milestone at a time.
4. Keep changes reviewable and reversible.
5. Do not create cloud resources, spend money, publish, send invitations or use real credentials without explicit approval.
6. Never use real bank statements or personal financial data in tests, fixtures, screenshots, logs or commits.
7. Preserve unrelated user changes in a dirty worktree.
8. Review the diff for security, access-control, rounding and regression risks.

## Intended stack

- Next.js App Router and strict TypeScript
- React
- Tailwind CSS and shadcn/ui
- Supabase PostgreSQL, Auth, Realtime, migrations and generated types
- Zod and React Hook Form
- Vitest, Testing Library and Playwright
- npm, ESLint and Prettier

Use current stable releases when scaffolding. Do not invent versions. Add a dependency only when it materially reduces complexity and is maintained for the use case.

## Architecture

- Organize product code by feature under `src/features`.
- Keep reusable primitives in `src/components/ui`.
- Keep money, dates, validation and Supabase setup in `src/lib`.
- Keep trusted repositories and services in `src/server`.
- Do not put business formulas inside React components.
- Do not couple UI directly to raw database response shapes.
- Put database changes in ordered Supabase migrations.
- Generate database types instead of duplicating them manually.
- A development demo repository may exist behind a clear interface. It must be impossible to enable accidentally in production.

## Financial invariants

- Store money as integer minor units plus ISO currency code.
- Never use floating-point arithmetic for stored money.
- Entered savings amounts are positive; transaction type determines direction.
- Only savings transactions affect goal balance.
- Initial balance is an auditable adjustment transaction.
- Expenses never affect savings progress.
- Potential savings contains only explicitly discretionary expenses.
- Transfers between the user's own accounts are excluded from expense analytics.
- Currency becomes immutable after the first financial transaction.
- Soft-deleted entries are excluded from totals but retained for audit and restore.
- Financial mutations retain immutable creator and current updater identities.
- Date calculations handle expired goals and never divide by zero.
- Numeric progress may exceed 100%; only the visual bar is capped.

## Authentication and authorization

- Google OAuth is the first live provider. Apple OAuth is required later and must remain architecturally supported.
- Never implement application-managed passwords.
- Accept invitations by a one-time token, not only by OAuth-email matching.
- Store invitation tokens only as secure hashes.
- Use server-side session handling and allowlisted OAuth redirects.
- Enable and test RLS for every table exposed through Supabase APIs.
- Never expose `service_role` or another secret key to browser code.
- Never treat a hidden button as authorization.
- Only the owner manages members or archives/deletes a goal.
- Write audit entries through a trusted server path or database trigger, never as an authoritative client payload.

## Import safety

- MVP imports CSV and XLSX only, never PDF.
- Prefer client-side parsing and do not retain the original statement by default.
- Never execute spreadsheet formulas or macros.
- Validate type, size, row count, dates, amounts and required mappings.
- Require preview and explicit confirmation before commit.
- Calculate file hash and row fingerprints for duplicates.
- Commit confirmed rows atomically.
- Do not send imported descriptions to an external AI service.
- Mask probable account/card numbers in previews and logs.

## UI and content

- Russian is the first UI language. Centralize strings for future English localization.
- Design mobile-first at 390 px and verify desktop at 1440 px.
- Follow the warm visual system in `PRODUCT_SPEC.md`.
- Use semantic design tokens for product colors; feature components must not depend on one theme palette.
- Keep primary screens visually hierarchical: key numbers and primary actions first, secondary explanations and rare actions quieter or collapsible.
- Avoid banking blue, loud gradients, piggy-bank imagery and competition between participants.
- Use tabular numerals for amounts.
- Charts require text equivalents and cannot rely on color alone.
- Meet WCAG AA contrast, keyboard, focus, label, error and reduced-motion requirements.
- Empty states explain the next useful action.
- Destructive actions require deliberate confirmation.

## Testing requirements

For each relevant change:

- add or update unit tests for business rules;
- add integration coverage for authorization or data mutations;
- add/update E2E coverage for a changed critical flow;
- run type checking, lint, unit tests, relevant E2E tests and production build;
- report exactly what passed, failed or could not run.

Minimum high-risk tests:

- expenses never change savings progress;
- a member cannot archive/delete a goal through UI or direct API;
- a non-member cannot read goal data;
- imports preview before commit and prevent duplicates;
- money calculations preserve minor units;
- archived goals are read-only;
- soft deletion updates totals without erasing audit history.

## Commands

Once scaffolded, keep these scripts working:

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

If external credentials or services are missing, use a safe local substitute where possible and state the blocker. Never fabricate success.

## Definition of done

A task is complete only when:

1. Behavior matches `PRODUCT_SPEC.md` and the current task.
2. Security and financial invariants remain intact.
3. Relevant automated checks pass.
4. Changed UI is inspected at mobile and desktop sizes.
5. Loading, empty, success and error states are covered where applicable.
6. No secrets, real financial data, debug output or unrelated files are committed.
7. Documentation is updated when behavior, setup, schema or commands change.

## Release workflow after first web release

- Every successful product change must pass lint, typecheck, unit tests and production build before commit/push.
- Keep production user data in the existing production Supabase project; never create a replacement database merely to rename or graduate a beta release.
- Do not commit `.env*`, `.vercel`, database credentials, OAuth secrets, dumps with real user data or support inbox contents.
- Multi-currency support is a post-MVP schema change. Do not implement currency conversion by weakening the current single-currency invariants; update the spec and migrations first.
