-- Stage 3.4: per-goal category appearance/default overrides and safe category archival.

begin;

create table if not exists public.expense_category_overrides (
  goal_id uuid not null references public.goals(id) on delete restrict,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  icon text,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  default_discretionary boolean,
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (goal_id, category_id)
);

create or replace function private.guard_category_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.expense_categories c
    where c.id = new.category_id
      and c.goal_id is null
      and c.is_system = true
      and c.archived_at is null
  ) then
    raise exception 'only active system categories can be overridden';
  end if;

  if tg_op = 'UPDATE' and (new.goal_id <> old.goal_id or new.category_id <> old.category_id) then
    raise exception 'category override identity is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists expense_category_overrides_guard on public.expense_category_overrides;
create trigger expense_category_overrides_guard
before insert or update on public.expense_category_overrides
for each row execute function private.guard_category_override();

drop trigger if exists expense_category_overrides_updated_at on public.expense_category_overrides;
create trigger expense_category_overrides_updated_at
before update on public.expense_category_overrides
for each row execute function private.set_updated_at();

alter table public.expense_category_overrides enable row level security;

revoke all on public.expense_category_overrides from anon, authenticated;
grant select, insert, update, delete on public.expense_category_overrides to authenticated;

drop policy if exists category_overrides_select on public.expense_category_overrides;
create policy category_overrides_select on public.expense_category_overrides
for select to authenticated
using (private.is_goal_member(goal_id));

drop policy if exists category_overrides_insert on public.expense_category_overrides;
create policy category_overrides_insert on public.expense_category_overrides
for insert to authenticated
with check (
  private.is_goal_writable_member(goal_id)
  and updated_by = (select auth.uid())
);

drop policy if exists category_overrides_update on public.expense_category_overrides;
create policy category_overrides_update on public.expense_category_overrides
for update to authenticated
using (private.is_goal_writable_member(goal_id))
with check (
  private.is_goal_writable_member(goal_id)
  and updated_by = (select auth.uid())
);

drop policy if exists category_overrides_delete on public.expense_category_overrides;
create policy category_overrides_delete on public.expense_category_overrides
for delete to authenticated
using (private.is_goal_writable_member(goal_id));

create or replace function public.archive_expense_category(p_goal_id uuid, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_goal_writable_member(p_goal_id) then
    raise exception 'not allowed';
  end if;

  if not exists (
    select 1
    from public.expense_categories c
    where c.id = p_category_id
      and c.goal_id = p_goal_id
      and c.is_system = false
      and c.archived_at is null
  ) then
    raise exception 'custom category is not available';
  end if;

  -- Disable learned rules first because the rule guard requires an active category.
  update public.categorization_rules
  set is_active = false
  where goal_id = p_goal_id
    and category_id = p_category_id
    and is_active = true;

  update public.expense_categories
  set archived_at = now()
  where id = p_category_id
    and goal_id = p_goal_id
    and is_system = false;
end;
$$;

create or replace function public.restore_expense_category(p_goal_id uuid, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_goal_writable_member(p_goal_id) then
    raise exception 'not allowed';
  end if;

  update public.expense_categories
  set archived_at = null
  where id = p_category_id
    and goal_id = p_goal_id
    and is_system = false
    and archived_at is not null;

  if not found then
    raise exception 'archived custom category is not available';
  end if;
end;
$$;

revoke all on function public.archive_expense_category(uuid, uuid) from public, anon;
revoke all on function public.restore_expense_category(uuid, uuid) from public, anon;
grant execute on function public.archive_expense_category(uuid, uuid) to authenticated;
grant execute on function public.restore_expense_category(uuid, uuid) to authenticated;

create or replace function private.audit_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  goal uuid;
  entity uuid;
  before_safe jsonb := null;
  after_safe jsonb := null;
begin
  if actor is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_table_name = 'expense_categories' then
    goal := coalesce(new.goal_id, old.goal_id);
    entity := coalesce(new.id, old.id);
    -- Global system categories are not changed by application users.
    if goal is null then
      if tg_op = 'DELETE' then return old; else return new; end if;
    end if;
    if tg_op = 'UPDATE' then before_safe := to_jsonb(old); end if;
    after_safe := to_jsonb(new);
  else
    goal := coalesce(new.goal_id, old.goal_id);
    entity := coalesce(new.category_id, old.category_id);
    if tg_op = 'UPDATE' or tg_op = 'DELETE' then before_safe := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then after_safe := to_jsonb(new); end if;
  end if;

  insert into public.audit_log(goal_id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
  values (
    goal,
    actor,
    'expense_category',
    entity,
    case when tg_op = 'INSERT' then 'create'::public.audit_action else 'update'::public.audit_action end,
    before_safe,
    after_safe
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists expense_categories_audit on public.expense_categories;
create trigger expense_categories_audit
after insert or update on public.expense_categories
for each row execute function private.audit_category_change();

drop trigger if exists expense_category_overrides_audit on public.expense_category_overrides;
create trigger expense_category_overrides_audit
after insert or update or delete on public.expense_category_overrides
for each row execute function private.audit_category_change();

-- Realtime for collaborative category settings. Invitations remain intentionally excluded.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'expense_categories',
    'expense_category_overrides',
    'categorization_rules'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;

commit;
