# Stage 2.2 update

This update keeps the existing Supabase schema. No new SQL migration is required beyond `202608310002_fix_invitation_acceptance.sql`, which is already included in the project.

Added:

- goal title, target amount and target date editing for active members;
- soft deletion and restoration for savings transactions and expenses;
- visible audit history;
- recently deleted operations list;
- quieter participant management and goal settings;
- clearer grouping of row actions.

Financial invariants are unchanged: expenses never affect saved balance or goal progress, deleted rows are excluded from totals and money stays in integer minor units.
