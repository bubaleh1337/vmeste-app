begin;

create or replace function private.guard_financial_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  goal_currency char(3);
  goal_state public.goal_status;
  balance_before bigint;
  signed_new bigint;
  signed_old bigint := 0;
  total_before bigint;
  total_after bigint;
begin
  select currency_code, status into goal_currency, goal_state
  from public.goals
  where id = new.goal_id and deleted_at is null;

  if goal_currency is null then raise exception 'goal not found'; end if;
  if goal_state = 'archived' then raise exception 'archived goals are read-only'; end if;

  if tg_op = 'INSERT' then
    if new.created_by <> (select auth.uid()) or new.updated_by <> (select auth.uid()) then
      raise exception 'creator/updater must match authenticated user';
    end if;
    new.created_at := now();
    new.updated_at := new.created_at;
  else
    if new.goal_id <> old.goal_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'goal and creator identity are immutable';
    end if;
    if new.updated_by <> (select auth.uid()) then
      raise exception 'updater must match authenticated user';
    end if;
  end if;

  if tg_table_name = 'savings_transactions' then
    if new.currency_code not in ('KZT', 'EUR', 'USD', 'RUB') then
      raise exception 'unsupported savings currency';
    end if;
    if tg_op = 'UPDATE' and new.currency_code <> old.currency_code then
      raise exception 'savings transaction currency is immutable; recreate the transaction instead';
    end if;
    if not exists (
      select 1 from public.goal_members gm
      where gm.goal_id = new.goal_id and gm.user_id = new.contributor_user_id and gm.status = 'active'
    ) then
      raise exception 'contributor must be an active goal member';
    end if;

    -- A negative-balance guard remains meaningful per original currency.
    -- FX conversion is display/goal-progress logic and never rewrites source amounts.
    perform 1 from public.goals where id = new.goal_id for update;
    select coalesce(sum(
      case when s.type in ('contribution','interest','adjustment_plus') then s.amount_minor else -s.amount_minor end
    ), 0)
    into balance_before
    from public.savings_transactions s
    where s.goal_id = new.goal_id
      and s.currency_code = new.currency_code
      and s.deleted_at is null
      and (tg_op = 'INSERT' or s.id <> new.id);

    signed_new := case when new.deleted_at is not null then 0
      when new.type in ('contribution','interest','adjustment_plus') then new.amount_minor
      else -new.amount_minor end;

    if tg_op = 'UPDATE' then
      signed_old := case when old.deleted_at is not null then 0
        when old.type in ('contribution','interest','adjustment_plus') then old.amount_minor
        else -old.amount_minor end;
    end if;

    total_before := balance_before + signed_old;
    total_after := balance_before + signed_new;

    if total_after < 0 and total_after < total_before then
      if new.type <> 'adjustment_minus' or not new.negative_balance_confirmed then
        raise exception 'savings balance cannot be reduced below zero without a confirmed negative adjustment';
      end if;
    end if;
  elsif tg_table_name = 'expenses' then
    if new.currency_code <> goal_currency then
      raise exception 'expense currency must match goal currency';
    end if;
    if not exists (
      select 1 from public.goal_members gm
      where gm.goal_id = new.goal_id and gm.user_id = new.spent_by_user_id and gm.status = 'active'
    ) then
      raise exception 'spender must be an active goal member';
    end if;
    if not exists (
      select 1 from public.expense_categories c
      where c.id = new.category_id and (c.goal_id is null or c.goal_id = new.goal_id) and c.archived_at is null
    ) then
      raise exception 'expense category is not available for this goal';
    end if;
  end if;

  return new;
end;
$$;

commit;
