begin;

select plan(11);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.goals'::regclass), 'goals has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.goal_members'::regclass), 'goal_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.goal_invitations'::regclass), 'goal_invitations has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.savings_transactions'::regclass), 'savings_transactions has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.expense_categories'::regclass), 'expense_categories has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.expenses'::regclass), 'expenses has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.categorization_rules'::regclass), 'categorization_rules has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.imports'::regclass), 'imports has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.import_rows'::regclass), 'import_rows has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass), 'audit_log has RLS enabled');

select * from finish();
rollback;
