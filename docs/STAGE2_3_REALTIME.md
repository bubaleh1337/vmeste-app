# Stage 2.3 — Realtime collaboration

This update adds automatic refresh of an open goal when another participant changes shared data.

Watched tables:

- `goals`
- `goal_members`
- `savings_transactions`
- `expenses`
- `audit_log`

The browser subscribes with the authenticated Supabase session. Postgres Changes respects the existing RLS SELECT policies, so a non-member does not receive rows for a goal they cannot read.

## Apply

Run `supabase/migrations/202608310003_enable_realtime.sql` once in the Supabase SQL Editor, then restart the Next.js development server.

## Manual two-user check

1. Open the same goal in two authenticated browser sessions.
2. Add a small savings transaction in session B.
3. Do not refresh session A.
4. Within a short moment, session A should show the new saved amount, participant contribution and audit entry.
5. Repeat with an expense and with editing or soft-deleting the test transaction.

If the Realtime channel cannot subscribe, the goal page shows a small warning. Normal operation stays visually quiet.


## 2.3.1 authenticated Realtime fix

The browser subscription now explicitly bootstraps the Realtime socket with the current Supabase Auth access token before subscribing. This matters for Postgres Changes on RLS-protected tables: a WebSocket can report `SUBSCRIBED` while row events are filtered when the Realtime connection does not have the authenticated user's JWT. The token is refreshed on Auth state changes.
