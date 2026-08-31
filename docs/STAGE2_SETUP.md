# Stage 2 setup — Supabase + Google OAuth

Use this checklist only when you are ready to connect the local application to a real cloud project.

## 1. Create the Supabase project

1. Open the Supabase Dashboard and create a new project.
2. Keep the database password in your password manager. Do not put it in Git or `.env.local` unless a specific CLI operation requires it interactively.
3. In the project's **Connect** dialog copy:
   - Project URL;
   - Publishable key.
4. Put only those two public values into `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not use a `service_role` key in the Next.js browser/server client configured by this repository.

## 2. Apply the database migration

Safest first-time route:

1. Supabase Dashboard → **SQL Editor**.
2. Open `supabase/migrations/202608310001_stage2_core.sql` locally.
3. Copy the complete file into a new SQL query.
4. Review that the selected project is the intended development project.
5. Run the migration once.

The migration creates the application tables, RLS policies, trusted RPCs, audit triggers, read views and default expense categories. It does not insert real financial data.

For a later repeatable CLI workflow, initialize/link Supabase CLI and use migrations rather than manually editing production tables.

## 3. Configure Supabase redirect URLs

Supabase Dashboard → Auth → URL Configuration:

- Site URL: `http://localhost:3000`
- Additional Redirect URLs: `http://localhost:3000/**`

The wildcard is useful only for local development. Production should use exact HTTPS redirect paths.

## 4. Configure Google OAuth

In Google Auth Platform:

1. Create/select a Google Cloud project.
2. Configure the OAuth audience/consent screen.
3. Keep scopes minimal: `openid`, email and profile.
4. Create an OAuth Client ID of type **Web application**.
5. Authorized JavaScript origin for local development: `http://localhost:3000`.
6. Authorized redirect URI: use the **Supabase callback URL shown on the Google provider page in your Supabase Dashboard**. Do not substitute the Next.js `/auth/callback` route here.
7. Copy the Google Client ID and Client Secret into Supabase Dashboard → Auth → Providers → Google and enable the provider.

The flow is: app → Supabase Auth → Google → Supabase callback → app `/auth/callback` → cookie session.

## 5. First live test

Restart the development server after changing `.env.local`:

```powershell
npm install
npm run dev
```

Then test in this order:

1. Open `http://localhost:3000`.
2. Sign in with Google.
3. Choose a display name.
4. Create a small test goal with synthetic amounts.
5. Add one savings transaction and one expense; confirm the expense does not alter savings progress.
6. Generate an invitation link as owner.
7. Open the link in a separate browser profile/incognito window and sign in with a second Google account.
8. Accept the invitation and confirm both users can see the shared goal.
9. As the member, verify there is no owner control for archiving/removing members.
10. Archive the goal as owner and confirm all mutation controls disappear.

Do not use a real bank statement or sensitive financial data for this first live test.

## 6. Generate database types

After the project is linked with Supabase CLI:

```powershell
npm run db:types
```

Commit the generated `src/lib/supabase/database.generated.ts`. Until the project exists, that file is intentionally not fabricated.

## 7. Automated checks

Application checks:

```powershell
npm run lint
npm run typecheck
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

Database/RLS tests require a local Supabase test database and the test-helper setup described in `supabase/tests/README.md`:

```powershell
npm run test:db
```

## References

- Supabase Next.js tutorial: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Supabase Google Auth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase database testing: https://supabase.com/docs/guides/database/testing
- Supabase advanced pgTAP testing: https://supabase.com/docs/guides/local-development/testing/pgtap-extended
