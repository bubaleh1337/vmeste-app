begin;

-- Requires the official basejump-supabase_test_helpers package in the local test database.
select plan(14);

select tests.create_supabase_user('owner_user', 'owner@example.test');
select tests.create_supabase_user('member_user', 'member@example.test');
select tests.create_supabase_user('outsider_user', 'outsider@example.test');

select tests.authenticate_as('owner_user');

select lives_ok(
  $$select public.create_goal('RLS Test Goal', 1000000, 'KZT', current_date + 180, null)$$,
  'owner can create a goal through the trusted RPC'
);

select lives_ok(
  $$select * from public.create_goal_invitation((select id from public.goals where title = 'RLS Test Goal'), repeat('a', 64), null)$$,
  'owner can create a seven-day invitation through the trusted RPC'
);

select tests.authenticate_as('member_user');

select lives_ok(
  $$select public.accept_goal_invitation(repeat('a', 64))$$,
  'invited user can accept a valid one-time invitation'
);

select results_eq(
  $$select count(*) from public.goals where title = 'RLS Test Goal'$$,
  array[1::bigint],
  'active member can read the shared goal'
);

select lives_ok(
  $$
    insert into public.savings_transactions(
      goal_id, type, amount_minor, currency_code, transaction_date,
      contributor_user_id, description, source, created_by, updated_by
    )
    select id, 'contribution', 100000, 'KZT', current_date,
           tests.get_supabase_uid('member_user'), 'Test contribution', 'manual',
           tests.get_supabase_uid('member_user'), tests.get_supabase_uid('member_user')
    from public.goals where title = 'RLS Test Goal'
  $$,
  'member can add a savings transaction'
);

select lives_ok(
  $$
    insert into public.expenses(
      goal_id, amount_minor, currency_code, transaction_date, description_raw,
      merchant_normalized, category_id, spent_by_user_id, is_discretionary,
      analytics_status, source, created_by, updated_by
    )
    select g.id, 25000, 'KZT', current_date, 'Test cafe', 'Test cafe', c.id,
           tests.get_supabase_uid('member_user'), true, 'included', 'manual',
           tests.get_supabase_uid('member_user'), tests.get_supabase_uid('member_user')
    from public.goals g
    join public.expense_categories c on c.key = 'cafes' and c.goal_id is null
    where g.title = 'RLS Test Goal'
  $$,
  'member can add an expense'
);

select results_eq(
  $$
    select coalesce(sum(case when type in ('contribution','interest','adjustment_plus') then amount_minor else -amount_minor end), 0)
    from public.savings_transactions
    where goal_id = (select id from public.goals where title = 'RLS Test Goal') and deleted_at is null
  $$,
  array[100000::numeric],
  'adding an expense does not change savings data'
);

select throws_ok(
  $$update public.goals set status = 'archived' where title = 'RLS Test Goal'$$,
  'P0001',
  'only the owner may archive or delete a goal',
  'member cannot archive a goal through a direct SQL/API-equivalent update'
);

select results_eq(
  $$
    with changed as (
      update public.goal_members
      set status = 'removed'
      where goal_id = (select id from public.goals where title = 'RLS Test Goal')
        and user_id = tests.get_supabase_uid('owner_user')
      returning 1
    )
    select count(*) from changed
  $$,
  array[0::bigint],
  'member cannot manage memberships'
);

select tests.authenticate_as('outsider_user');

select results_eq(
  $$select count(*) from public.goals where title = 'RLS Test Goal'$$,
  array[0::bigint],
  'non-member cannot read goal data'
);

select results_eq(
  $$select count(*) from public.audit_log$$,
  array[0::bigint],
  'non-member cannot read goal audit data'
);

select throws_ok(
  $$select public.accept_goal_invitation(repeat('a', 64))$$,
  'P0001',
  'invitation is invalid or expired',
  'the same one-time invitation cannot be accepted again'
);

select tests.authenticate_as('owner_user');
select lives_ok(
  $$update public.goals set status = 'archived' where title = 'RLS Test Goal'$$,
  'owner can archive the goal'
);

select tests.authenticate_as('member_user');
select throws_ok(
  $$
    insert into public.savings_transactions(
      goal_id, type, amount_minor, currency_code, transaction_date,
      contributor_user_id, description, source, created_by, updated_by
    )
    select id, 'contribution', 1, 'KZT', current_date,
           tests.get_supabase_uid('member_user'), 'Blocked after archive', 'manual',
           tests.get_supabase_uid('member_user'), tests.get_supabase_uid('member_user')
    from public.goals where title = 'RLS Test Goal'
  $$,
  '42501',
  'new row violates row-level security policy for table "savings_transactions"',
  'archived goal is read-only for financial mutations'
);

select * from finish();
rollback;
