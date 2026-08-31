# Database tests

`database/001_schema_security.test.sql` uses pgTAP only.

`database/010_rls_access.test.sql` additionally uses Supabase's documented `basejump-supabase_test_helpers` package to create test users and switch authentication context. Install that helper **only in the local Supabase test database**, following Supabase's “Advanced pgTAP Testing” guide. Do not add it to the production migration.

After local Supabase is running and the helper is installed:

```powershell
npm run test:db
```

The access test covers the high-risk cases for Stage 2: owner/member/non-member isolation, one-time invitations, member write access, owner-only membership/archive actions, expense/savings separation and archived-goal read-only behavior.
