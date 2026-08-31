begin;

select plan(6);

select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='goals'), 'goals is in Realtime publication');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='goal_members'), 'goal_members is in Realtime publication');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='savings_transactions'), 'savings_transactions is in Realtime publication');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='expenses'), 'expenses is in Realtime publication');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='audit_log'), 'audit_log is in Realtime publication');
select ok(not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='goal_invitations'), 'goal_invitations is deliberately not published to Realtime');

select * from finish();
rollback;
