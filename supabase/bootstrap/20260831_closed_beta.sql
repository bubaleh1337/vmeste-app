-- "Вместе" closed beta bootstrap
-- Generated from the ordered migrations on 2026-08-31.
-- Run ONCE on a new, empty Supabase beta project.
-- Do not run this aggregate file on an existing development database.


-- ============================================================================
-- BEGIN: 202608310001_stage2_core.sql
-- ============================================================================
begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.goal_role as enum ('owner', 'member');
create type public.goal_member_status as enum ('active', 'removed');
create type public.goal_status as enum ('active', 'reached', 'archived');
create type public.savings_transaction_type as enum ('contribution', 'interest', 'withdrawal', 'fee', 'adjustment_plus', 'adjustment_minus');
create type public.transaction_source as enum ('manual', 'csv', 'xlsx');
create type public.analytics_status as enum ('included', 'excluded', 'needs_review');
create type public.import_target_kind as enum ('savings', 'expenses');
create type public.import_status as enum ('preview', 'committed', 'failed', 'cancelled');
create type public.import_row_status as enum ('pending', 'accepted', 'skipped', 'duplicate', 'error');
create type public.match_type as enum ('contains', 'starts_with', 'exact');
create type public.audit_action as enum ('create', 'update', 'soft_delete', 'restore', 'invite', 'join', 'remove_member', 'archive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  locale text not null default 'ru-KZ',
  timezone text not null default 'Asia/Atyrau',
  theme_key text not null default 'sage' check (theme_key in ('sage','rose','lavender','ocean','sky','honey')),
  font_key text not null default 'onest' check (font_key in ('onest','manrope','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text,
  target_amount_minor bigint not null check (target_amount_minor > 0),
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  target_date date not null,
  accent_color text,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.goal_members (
  goal_id uuid not null references public.goals(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role public.goal_role not null default 'member',
  status public.goal_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (goal_id, user_id)
);

create table public.goal_invitations (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  intended_email text,
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete restrict,
  type public.savings_transaction_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  transaction_date date not null,
  contributor_user_id uuid not null references public.profiles(id),
  description text not null default '',
  note text,
  source public.transaction_source not null default 'manual',
  import_row_id uuid,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  negative_balance_confirmed boolean not null default false,
  check (
    type not in ('adjustment_plus', 'adjustment_minus')
    or (note is not null and char_length(trim(note)) > 0)
  )
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references public.goals(id) on delete restrict,
  key text not null,
  name text not null,
  icon text,
  color text,
  default_discretionary boolean not null default false,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique nulls not distinct (goal_id, key)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete restrict,
  amount_minor bigint not null check (amount_minor <> 0),
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  transaction_date date not null,
  description_raw text not null,
  merchant_normalized text not null,
  category_id uuid not null references public.expense_categories(id),
  spent_by_user_id uuid not null references public.profiles(id),
  is_discretionary boolean not null default false,
  analytics_status public.analytics_status not null default 'included',
  source public.transaction_source not null default 'manual',
  import_row_id uuid,
  note text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  match_type public.match_type not null,
  pattern_normalized text not null,
  category_id uuid not null references public.expense_categories(id),
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  target_kind public.import_target_kind not null,
  file_name text not null,
  file_type text not null check (file_type in ('csv', 'xlsx')),
  file_sha256 text not null check (char_length(file_sha256) = 64),
  mapping_json jsonb not null default '{}'::jsonb,
  status public.import_status not null default 'preview',
  total_rows integer not null default 0 check (total_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  unique (goal_id, file_sha256)
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  normalized_date date,
  normalized_amount_minor bigint,
  normalized_description text,
  normalized_json jsonb not null default '{}'::jsonb,
  fingerprint text,
  status public.import_row_status not null default 'pending',
  error_code text,
  created_at timestamptz not null default now(),
  unique (import_id, row_number)
);

alter table public.savings_transactions
  add constraint savings_import_row_fk foreign key (import_row_id) references public.import_rows(id) on delete restrict;
alter table public.expenses
  add constraint expenses_import_row_fk foreign key (import_row_id) references public.import_rows(id) on delete restrict;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action public.audit_action not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index goal_members_user_id_idx on public.goal_members(user_id) where status = 'active';
create index goal_invitations_goal_id_idx on public.goal_invitations(goal_id);
create index savings_goal_date_idx on public.savings_transactions(goal_id, transaction_date desc) where deleted_at is null;
create index savings_contributor_idx on public.savings_transactions(contributor_user_id) where deleted_at is null;
create index expenses_goal_date_idx on public.expenses(goal_id, transaction_date desc) where deleted_at is null;
create index expenses_spent_by_idx on public.expenses(spent_by_user_id) where deleted_at is null;
create index expenses_category_idx on public.expenses(category_id) where deleted_at is null;
create index category_rules_goal_idx on public.categorization_rules(goal_id) where is_active;
create index imports_goal_idx on public.imports(goal_id);
create index import_rows_import_idx on public.import_rows(import_id);
create index import_rows_fingerprint_idx on public.import_rows(fingerprint) where fingerprint is not null;
create index audit_goal_created_idx on public.audit_log(goal_id, created_at desc);

create or replace function private.is_goal_member(p_goal_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.goal_members gm
    join public.goals g on g.id = gm.goal_id
    where gm.goal_id = p_goal_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'active'
      and g.deleted_at is null
  );
$$;

create or replace function private.is_goal_owner(p_goal_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.goals g
    where g.id = p_goal_id
      and g.owner_id = (select auth.uid())
      and g.deleted_at is null
  );
$$;

create or replace function private.is_goal_writable_member(p_goal_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.goal_members gm
    join public.goals g on g.id = gm.goal_id
    where gm.goal_id = p_goal_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'active'
      and g.deleted_at is null
      and g.status <> 'archived'
  );
$$;

create or replace function private.is_goal_writable_owner(p_goal_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.goals g
    where g.id = p_goal_id
      and g.owner_id = (select auth.uid())
      and g.deleted_at is null
      and g.status <> 'archived'
  );
$$;

create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.goal_members mine
      join public.goal_members theirs on theirs.goal_id = mine.goal_id
      join public.goals g on g.id = mine.goal_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = p_profile_id
        and theirs.status = 'active'
        and g.deleted_at is null
    );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_goal_member(uuid) from public;
revoke all on function private.is_goal_owner(uuid) from public;
revoke all on function private.can_view_profile(uuid) from public;
revoke all on function private.is_goal_writable_member(uuid) from public;
revoke all on function private.is_goal_writable_owner(uuid) from public;
grant execute on function private.is_goal_member(uuid) to authenticated;
grant execute on function private.is_goal_owner(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.is_goal_writable_member(uuid) to authenticated;
grant execute on function private.is_goal_writable_owner(uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger goals_updated_at before update on public.goals for each row execute function private.set_updated_at();
create trigger savings_updated_at before update on public.savings_transactions for each row execute function private.set_updated_at();
create trigger expenses_updated_at before update on public.expenses for each row execute function private.set_updated_at();
create trigger categorization_rules_updated_at before update on public.categorization_rules for each row execute function private.set_updated_at();

create or replace function private.guard_goal_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'archived' then
    raise exception 'archived goals are read-only';
  end if;

  if new.owner_id <> old.owner_id then
    raise exception 'goal owner cannot be changed directly';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'goal creation timestamp is immutable';
  end if;

  if new.currency_code <> old.currency_code and exists (
    select 1 from public.savings_transactions s where s.goal_id = old.id
    union all
    select 1 from public.expenses e where e.goal_id = old.id
  ) then
    raise exception 'goal currency is immutable after the first financial transaction';
  end if;

  if not private.is_goal_owner(old.id) then
    if new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at then
      raise exception 'only the owner may archive or delete a goal';
    end if;
  end if;

  return new;
end;
$$;

create trigger goals_guard_update before update on public.goals for each row execute function private.guard_goal_update();

create or replace function private.guard_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.goals g where g.id = old.goal_id and g.status = 'archived') then
    raise exception 'archived goals are read-only';
  end if;
  if new.goal_id <> old.goal_id or new.user_id <> old.user_id or new.role <> old.role or new.joined_at <> old.joined_at then
    raise exception 'membership identity and role are immutable';
  end if;
  if old.role = 'owner' and new.status <> old.status then
    raise exception 'owner membership cannot be removed';
  end if;
  if new.status = 'removed' and old.status <> 'removed' then
    new.removed_at := now();
  elsif new.status = 'active' then
    new.removed_at := null;
  elsif old.status = 'removed' then
    new.removed_at := old.removed_at;
  end if;
  return new;
end;
$$;

create trigger goal_members_guard_update before update on public.goal_members for each row execute function private.guard_member_update();

create or replace function private.guard_invitation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.goal_id <> old.goal_id or new.created_by <> old.created_by or new.token_hash <> old.token_hash
     or new.expires_at <> old.expires_at or new.created_at <> old.created_at then
    raise exception 'invitation identity is immutable';
  end if;

  return new;
end;
$$;

create trigger goal_invitations_guard_update before update on public.goal_invitations for each row execute function private.guard_invitation_update();

create or replace function private.guard_category_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.goal_id is distinct from old.goal_id or new.key <> old.key or new.is_system <> old.is_system or new.created_by is distinct from old.created_by then
    raise exception 'category identity is immutable';
  end if;
  return new;
end;
$$;

create trigger expense_categories_guard_update before update on public.expense_categories for each row execute function private.guard_category_update();

create or replace function private.guard_rule_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.goal_id <> old.goal_id or new.created_by <> old.created_by) then
    raise exception 'categorization rule identity is immutable';
  end if;
  if not exists (
    select 1 from public.expense_categories c
    where c.id = new.category_id
      and (c.goal_id is null or c.goal_id = new.goal_id)
      and c.archived_at is null
  ) then
    raise exception 'categorization rule category is not available for this goal';
  end if;
  return new;
end;
$$;

create trigger categorization_rules_guard before insert or update on public.categorization_rules for each row execute function private.guard_rule_update();

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
  select currency_code, status into goal_currency, goal_state from public.goals where id = new.goal_id and deleted_at is null;
  if goal_currency is null then raise exception 'goal not found'; end if;
  if goal_state = 'archived' then raise exception 'archived goals are read-only'; end if;
  if new.currency_code <> goal_currency then raise exception 'transaction currency must match goal currency'; end if;

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
    if not exists (
      select 1 from public.goal_members gm
      where gm.goal_id = new.goal_id and gm.user_id = new.contributor_user_id and gm.status = 'active'
    ) then
      raise exception 'contributor must be an active goal member';
    end if;

    perform 1 from public.goals where id = new.goal_id for update;
    select coalesce(sum(
      case when s.type in ('contribution','interest','adjustment_plus') then s.amount_minor else -s.amount_minor end
    ), 0)
    into balance_before
    from public.savings_transactions s
    where s.goal_id = new.goal_id
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

create trigger savings_guard before insert or update on public.savings_transactions for each row execute function private.guard_financial_row();
create trigger expenses_guard before insert or update on public.expenses for each row execute function private.guard_financial_row();

create or replace function private.audit_financial_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  act public.audit_action;
  before_value jsonb;
  after_value jsonb;
begin
  if actor is null then raise exception 'audit actor is required'; end if;
  if tg_op = 'INSERT' then
    act := 'create'; before_value := null; after_value := to_jsonb(new);
  else
    if old.deleted_at is null and new.deleted_at is not null then act := 'soft_delete';
    elsif old.deleted_at is not null and new.deleted_at is null then act := 'restore';
    else act := 'update'; end if;
    before_value := to_jsonb(old); after_value := to_jsonb(new);
  end if;
  insert into public.audit_log(goal_id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
  values (new.goal_id, actor, tg_table_name, new.id, act, before_value, after_value);
  return new;
end;
$$;

create trigger savings_audit after insert or update on public.savings_transactions for each row execute function private.audit_financial_change();
create trigger expenses_audit after insert or update on public.expenses for each row execute function private.audit_financial_change();

create or replace function private.audit_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); act public.audit_action;
begin
  if actor is null then return new; end if;
  if tg_op = 'INSERT' then act := case when new.role = 'owner' then 'create' else 'join' end;
  elsif old.status = 'active' and new.status = 'removed' then act := 'remove_member';
  else act := 'update'; end if;
  insert into public.audit_log(goal_id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
  values (new.goal_id, actor, 'goal_member', new.user_id, act, case when tg_op='INSERT' then null else to_jsonb(old) end, to_jsonb(new));
  return new;
end;
$$;

create trigger goal_members_audit after insert or update on public.goal_members for each row execute function private.audit_member_change();

create or replace function private.audit_goal_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  act public.audit_action;
begin
  if actor is null then return new; end if;
  if tg_op = 'INSERT' then act := 'create';
  elsif old.deleted_at is null and new.deleted_at is not null then act := 'soft_delete';
  elsif old.deleted_at is not null and new.deleted_at is null then act := 'restore';
  elsif old.status <> 'archived' and new.status = 'archived' then act := 'archive';
  else act := 'update'; end if;
  insert into public.audit_log(goal_id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
  values (new.id, actor, 'goal', new.id, act, case when tg_op='INSERT' then null else to_jsonb(old) end, to_jsonb(new));
  return new;
end;
$$;

create trigger goals_audit after insert or update on public.goals for each row execute function private.audit_goal_change();

create or replace function private.audit_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  before_safe jsonb;
  after_safe jsonb;
begin
  if actor is null then return new; end if;
  if tg_op = 'UPDATE' then
    before_safe := jsonb_build_object('id', old.id, 'expires_at', old.expires_at, 'accepted_at', old.accepted_at, 'revoked_at', old.revoked_at);
  end if;
  after_safe := jsonb_build_object('id', new.id, 'expires_at', new.expires_at, 'accepted_at', new.accepted_at, 'revoked_at', new.revoked_at);
  insert into public.audit_log(goal_id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
  values (new.goal_id, actor, 'goal_invitation', new.id, case when tg_op='INSERT' then 'invite'::public.audit_action else 'update'::public.audit_action end, before_safe, after_safe);
  return new;
end;
$$;

create trigger goal_invitations_audit after insert or update on public.goal_invitations for each row execute function private.audit_invitation_change();

create or replace function public.create_goal(
  p_title text,
  p_target_amount_minor bigint,
  p_currency_code char(3),
  p_target_date date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid := (select auth.uid());
  new_goal_id uuid;
begin
  if user_id is null then raise exception 'authentication required'; end if;
  if p_target_amount_minor <= 0 then raise exception 'target amount must be positive'; end if;
  if char_length(trim(p_title)) < 1 or char_length(trim(p_title)) > 120 then raise exception 'invalid title'; end if;

  insert into public.goals(owner_id, title, description, target_amount_minor, currency_code, target_date)
  values (user_id, trim(p_title), nullif(trim(p_description), ''), p_target_amount_minor, upper(p_currency_code), p_target_date)
  returning id into new_goal_id;

  insert into public.goal_members(goal_id, user_id, role, status)
  values (new_goal_id, user_id, 'owner', 'active');

  return new_goal_id;
end;
$$;

revoke all on function public.create_goal(text,bigint,char,date,text) from public;
grant execute on function public.create_goal(text,bigint,char,date,text) to authenticated;

create or replace function public.create_goal_invitation(
  p_goal_id uuid,
  p_token_hash text,
  p_intended_email text default null
)
returns table(invitation_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid := (select auth.uid());
  new_id uuid;
  expiry timestamptz := now() + interval '7 days';
begin
  if user_id is null then raise exception 'authentication required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation token hash'; end if;
  if not private.is_goal_writable_owner(p_goal_id) then
    raise exception 'only the owner of an active goal may create invitations';
  end if;

  insert into public.goal_invitations(goal_id, created_by, token_hash, intended_email, expires_at)
  values (p_goal_id, user_id, p_token_hash, nullif(trim(p_intended_email), ''), expiry)
  returning id into new_id;

  return query select new_id, expiry;
end;
$$;

revoke all on function public.create_goal_invitation(uuid,text,text) from public;
grant execute on function public.create_goal_invitation(uuid,text,text) to authenticated;

create or replace function public.accept_goal_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  invitation public.goal_invitations%rowtype;
  existing_role public.goal_role;
  existing_status public.goal_member_status;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid invitation token';
  end if;

  select i.* into invitation
  from public.goal_invitations i
  join public.goals g on g.id = i.goal_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and g.deleted_at is null
    and g.status <> 'archived'
  for update of i;

  if invitation.id is null then
    raise exception 'invitation is invalid or expired';
  end if;

  select gm.role, gm.status
    into existing_role, existing_status
  from public.goal_members gm
  where gm.goal_id = invitation.goal_id
    and gm.user_id = v_user_id
  for update;

  if existing_role is null then
    insert into public.goal_members(goal_id, user_id, role, status, joined_at, removed_at)
    values (invitation.goal_id, v_user_id, 'member', 'active', now(), null);
  elsif existing_status = 'removed' then
    update public.goal_members
    set status = 'active', removed_at = null
    where goal_id = invitation.goal_id
      and user_id = v_user_id;
  end if;

  update public.goal_invitations
  set accepted_by = v_user_id,
      accepted_at = now()
  where id = invitation.id;

  return invitation.goal_id;
end;
$$;

revoke all on function public.accept_goal_invitation(text) from public;
grant execute on function public.accept_goal_invitation(text) to authenticated;


create or replace function public.get_goal_invitation_preview(p_token_hash text)
returns table(goal_id uuid, goal_title text, expires_at timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select i.goal_id, g.title, i.expires_at
  from public.goal_invitations i
  join public.goals g on g.id = i.goal_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and g.deleted_at is null
    and g.status <> 'archived'
  limit 1;
$$;

revoke all on function public.get_goal_invitation_preview(text) from public;
grant execute on function public.get_goal_invitation_preview(text) to authenticated;


create or replace function public.revoke_goal_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_goal_id uuid;
begin
  select goal_id into invitation_goal_id
  from public.goal_invitations
  where id = p_invitation_id and accepted_at is null and revoked_at is null
  for update;

  if invitation_goal_id is null then raise exception 'active invitation not found'; end if;
  if not private.is_goal_writable_owner(invitation_goal_id) then raise exception 'only the owner of an active goal may revoke invitations'; end if;

  update public.goal_invitations set revoked_at = now() where id = p_invitation_id;
end;
$$;

revoke all on function public.revoke_goal_invitation(uuid) from public;
grant execute on function public.revoke_goal_invitation(uuid) to authenticated;

-- RLS: revoke broad anonymous access first, then grant only intended operations.
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.goal_members enable row level security;
alter table public.goal_invitations enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.categorization_rules enable row level security;
alter table public.imports enable row level security;
alter table public.import_rows enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles, public.goals, public.goal_members, public.goal_invitations,
  public.savings_transactions, public.expense_categories, public.expenses, public.categorization_rules,
  public.imports, public.import_rows, public.audit_log from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.goals to authenticated;
grant select, update on public.goal_members to authenticated;
grant select (id, goal_id, created_by, intended_email, expires_at, accepted_by, accepted_at, revoked_at, created_at) on public.goal_invitations to authenticated;
grant select, insert, update on public.savings_transactions to authenticated;
grant select, insert, update on public.expense_categories to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert, update on public.categorization_rules to authenticated;
grant select on public.imports to authenticated;
grant select on public.import_rows to authenticated;
grant select on public.audit_log to authenticated;


create policy profiles_select on public.profiles for select to authenticated using (private.can_view_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy goals_select on public.goals for select to authenticated using (private.is_goal_member(id));
create policy goals_update on public.goals for update to authenticated
  using (private.is_goal_member(id))
  with check (private.is_goal_member(id));

create policy goal_members_select on public.goal_members for select to authenticated using (private.is_goal_member(goal_id));
create policy goal_members_update on public.goal_members for update to authenticated
  using (private.is_goal_writable_owner(goal_id))
  with check (private.is_goal_writable_owner(goal_id));

create policy invitations_select on public.goal_invitations for select to authenticated using (private.is_goal_owner(goal_id));
create policy savings_select on public.savings_transactions for select to authenticated using (private.is_goal_member(goal_id));
create policy savings_insert on public.savings_transactions for insert to authenticated
  with check (private.is_goal_writable_member(goal_id) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy savings_update on public.savings_transactions for update to authenticated
  using (private.is_goal_writable_member(goal_id))
  with check (private.is_goal_writable_member(goal_id) and updated_by = (select auth.uid()));

create policy categories_select on public.expense_categories for select to authenticated
  using (goal_id is null or private.is_goal_member(goal_id));
create policy categories_insert on public.expense_categories for insert to authenticated
  with check (goal_id is not null and private.is_goal_writable_member(goal_id) and created_by = (select auth.uid()) and not is_system);
create policy categories_update on public.expense_categories for update to authenticated
  using (goal_id is not null and private.is_goal_writable_member(goal_id) and not is_system)
  with check (goal_id is not null and private.is_goal_writable_member(goal_id) and not is_system);

create policy expenses_select on public.expenses for select to authenticated using (private.is_goal_member(goal_id));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (private.is_goal_writable_member(goal_id) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy expenses_update on public.expenses for update to authenticated
  using (private.is_goal_writable_member(goal_id))
  with check (private.is_goal_writable_member(goal_id) and updated_by = (select auth.uid()));

create policy rules_select on public.categorization_rules for select to authenticated using (private.is_goal_member(goal_id));
create policy rules_insert on public.categorization_rules for insert to authenticated
  with check (private.is_goal_writable_member(goal_id) and created_by = (select auth.uid()));
create policy rules_update on public.categorization_rules for update to authenticated
  using (private.is_goal_writable_member(goal_id))
  with check (private.is_goal_writable_member(goal_id));

create policy imports_select on public.imports for select to authenticated using (private.is_goal_member(goal_id));
create policy import_rows_select on public.import_rows for select to authenticated
  using (exists (select 1 from public.imports i where i.id = import_id and private.is_goal_member(i.goal_id)));
create policy audit_select on public.audit_log for select to authenticated using (private.is_goal_member(goal_id));

create view public.goals_read
with (security_invoker = true)
as
select id, owner_id, title, description, target_amount_minor::text as target_amount_minor_text,
       currency_code, target_date, accent_color, status, created_at, updated_at, deleted_at
from public.goals;

create view public.savings_transactions_read
with (security_invoker = true)
as
select id, goal_id, type, amount_minor::text as amount_minor_text, currency_code, transaction_date,
       contributor_user_id, description, note, source, import_row_id, created_by, updated_by,
       created_at, updated_at, deleted_at, negative_balance_confirmed
from public.savings_transactions;

create view public.expenses_read
with (security_invoker = true)
as
select id, goal_id, amount_minor::text as amount_minor_text, currency_code, transaction_date,
       description_raw, merchant_normalized, category_id, spent_by_user_id, is_discretionary,
       analytics_status, source, import_row_id, note, created_by, updated_by, created_at, updated_at, deleted_at
from public.expenses;

revoke all on public.goals_read, public.savings_transactions_read, public.expenses_read from anon;
grant select on public.goals_read, public.savings_transactions_read, public.expenses_read to authenticated;

insert into public.expense_categories (goal_id, key, name, icon, color, default_discretionary, is_system)
values
  (null, 'groceries', U&'\041F\0440\043E\0434\0443\043A\0442\044B', 'shopping-basket', '#6F806A', false, true),
  (null, 'cafes', U&'\041A\0430\0444\0435 \0438 \0440\0435\0441\0442\043E\0440\0430\043D\044B', 'utensils', '#C88F87', true, true),
  (null, 'transport', U&'\0422\0440\0430\043D\0441\043F\043E\0440\0442', 'car', '#C2A15C', false, true),
  (null, 'housing', U&'\0416\0438\043B\044C\0451 \0438 \043A\043E\043C\043C\0443\043D\0430\043B\044C\043D\044B\0435 \0443\0441\043B\0443\0433\0438', 'house', '#8F9B88', false, true),
  (null, 'health', U&'\0417\0434\043E\0440\043E\0432\044C\0435 \0438 \0430\043F\0442\0435\043A\0438', 'heart-pulse', '#A87972', false, true),
  (null, 'beauty', U&'\041A\0440\0430\0441\043E\0442\0430 \0438 \0443\0445\043E\0434', 'sparkles', '#B69A8B', true, true),
  (null, 'shopping', U&'\041E\0434\0435\0436\0434\0430 \0438 \043F\043E\043A\0443\043F\043A\0438', 'shirt', '#9A836C', true, true),
  (null, 'subscriptions', U&'\041F\043E\0434\043F\0438\0441\043A\0438 \0438 \0441\0432\044F\0437\044C', 'wifi', '#7C8B7B', true, true),
  (null, 'entertainment', U&'\0420\0430\0437\0432\043B\0435\0447\0435\043D\0438\044F', 'ticket', '#B28B82', true, true),
  (null, 'education', U&'\041E\0431\0440\0430\0437\043E\0432\0430\043D\0438\0435', 'book-open', '#A38E64', false, true),
  (null, 'travel', U&'\041F\0443\0442\0435\0448\0435\0441\0442\0432\0438\044F', 'plane', '#87968B', true, true),
  (null, 'pets', U&'\041F\0438\0442\043E\043C\0446\044B', 'paw-print', '#A77F78', false, true),
  (null, 'gifts', U&'\041F\043E\0434\0430\0440\043A\0438 \0438 \043F\043E\043C\043E\0449\044C', 'gift', '#B79865', true, true),
  (null, 'taxes_fees', U&'\041D\0430\043B\043E\0433\0438 \0438 \043A\043E\043C\0438\0441\0441\0438\0438', 'receipt-text', '#7E7A70', false, true),
  (null, 'transfers', U&'\041F\0435\0440\0435\0432\043E\0434\044B', 'arrow-left-right', '#8B8B83', false, true),
  (null, 'cash', U&'\041D\0430\043B\0438\0447\043D\044B\0435', 'banknote', '#9A9489', false, true),
  (null, 'other', U&'\0414\0440\0443\0433\043E\0435', 'circle-ellipsis', '#918A80', false, true),
  (null, 'needs_review', U&'\0422\0440\0435\0431\0443\0435\0442 \043F\0440\043E\0432\0435\0440\043A\0438', 'circle-help', '#B85C4A', false, true);

commit;

-- ============================================================================
-- END: 202608310001_stage2_core.sql
-- ============================================================================

-- ============================================================================
-- BEGIN: 202608310002_fix_invitation_acceptance.sql
-- ============================================================================
begin;

-- Make invitation acceptance idempotent and compatible with the immutable
-- membership identity guard. In particular, do not rewrite joined_at for an
-- existing membership row.
create or replace function public.accept_goal_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  invitation public.goal_invitations%rowtype;
  existing_role public.goal_role;
  existing_status public.goal_member_status;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid invitation token';
  end if;

  select i.* into invitation
  from public.goal_invitations i
  join public.goals g on g.id = i.goal_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and g.deleted_at is null
    and g.status <> 'archived'
  for update of i;

  if invitation.id is null then
    raise exception 'invitation is invalid or expired';
  end if;

  select gm.role, gm.status
    into existing_role, existing_status
  from public.goal_members gm
  where gm.goal_id = invitation.goal_id
    and gm.user_id = v_user_id
  for update;

  if existing_role is null then
    insert into public.goal_members(goal_id, user_id, role, status, joined_at, removed_at)
    values (invitation.goal_id, v_user_id, 'member', 'active', now(), null);
  elsif existing_status = 'removed' then
    update public.goal_members
    set status = 'active', removed_at = null
    where goal_id = invitation.goal_id
      and user_id = v_user_id;
  end if;

  update public.goal_invitations
  set accepted_by = v_user_id,
      accepted_at = now()
  where id = invitation.id;

  return invitation.goal_id;
end;
$$;

revoke all on function public.accept_goal_invitation(text) from public;
grant execute on function public.accept_goal_invitation(text) to authenticated;

commit;

-- ============================================================================
-- END: 202608310002_fix_invitation_acceptance.sql
-- ============================================================================

-- ============================================================================
-- BEGIN: 202608310003_enable_realtime.sql
-- ============================================================================
-- Stage 2.3: enable Supabase Postgres Changes for collaborative goal screens.
-- Postgres Changes still obeys the SELECT RLS policies on each table.

do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach table_name in array array[
    'goals',
    'goal_members',
    'savings_transactions',
    'expenses',
    'audit_log'
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

-- ============================================================================
-- END: 202608310003_enable_realtime.sql
-- ============================================================================

-- ============================================================================
-- BEGIN: 202608310004_import_commit.sql
-- ============================================================================
-- Stage 3: safe CSV/XLSX preview duplicate checks and atomic import commit.
-- The original statement is never stored by these functions.

create extension if not exists pgcrypto with schema extensions;

create or replace function private.normalize_import_description(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function private.import_fingerprint(
  p_goal_id uuid,
  p_transaction_date date,
  p_amount_minor bigint,
  p_description text,
  p_participant_user_id uuid,
  p_type text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        p_goal_id::text || '|' || p_transaction_date::text || '|' || p_amount_minor::text || '|' ||
        private.normalize_import_description(p_description) || '|' || p_participant_user_id::text || '|' || p_type,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.normalize_import_description(text) from public;
revoke all on function private.import_fingerprint(uuid,date,bigint,text,uuid,text) from public;

create or replace function public.preview_financial_import(
  p_goal_id uuid,
  p_target_kind public.import_target_kind,
  p_file_sha256 text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row jsonb;
  v_row_number integer;
  v_date date;
  v_amount bigint;
  v_description text;
  v_participant uuid;
  v_type text;
  v_fingerprint text;
  v_seen text[] := array[]::text[];
  v_duplicates integer[] := array[]::integer[];
  v_is_duplicate boolean;
  v_file_exists boolean;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not private.is_goal_member(p_goal_id) then raise exception 'goal not available'; end if;
  if p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid file hash'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'too many import rows'; end if;

  select exists(
    select 1 from public.imports i
    where i.goal_id = p_goal_id and i.file_sha256 = p_file_sha256 and i.status = 'committed'
  ) into v_file_exists;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if nullif(v_row->>'errorCode', '') is not null then continue; end if;
    if nullif(v_row->>'normalizedDate', '') is null or nullif(v_row->>'amountMinor', '') is null then continue; end if;

    v_row_number := (v_row->>'rowNumber')::integer;
    v_date := (v_row->>'normalizedDate')::date;
    v_amount := (v_row->>'amountMinor')::bigint;
    v_description := coalesce(v_row->>'description', '');
    v_participant := (v_row->>'participantUserId')::uuid;
    v_type := case when p_target_kind = 'savings' then v_row->>'savingsType' else 'expense' end;
    if v_type is null then continue; end if;

    v_fingerprint := private.import_fingerprint(p_goal_id, v_date, v_amount, v_description, v_participant, v_type);
    v_is_duplicate := v_fingerprint = any(v_seen);

    if not v_is_duplicate and exists (
      select 1 from public.import_rows ir
      join public.imports i on i.id = ir.import_id
      where i.goal_id = p_goal_id and i.status = 'committed' and ir.fingerprint = v_fingerprint and ir.status = 'accepted'
    ) then
      v_is_duplicate := true;
    end if;

    if not v_is_duplicate and p_target_kind = 'savings' and exists (
      select 1 from public.savings_transactions s
      where s.goal_id = p_goal_id
        and s.deleted_at is null
        and s.transaction_date = v_date
        and s.amount_minor = v_amount
        and s.contributor_user_id = v_participant
        and s.type::text = v_type
        and private.normalize_import_description(s.description) = private.normalize_import_description(v_description)
    ) then
      v_is_duplicate := true;
    end if;

    if not v_is_duplicate and p_target_kind = 'expenses' and exists (
      select 1 from public.expenses e
      where e.goal_id = p_goal_id
        and e.deleted_at is null
        and e.transaction_date = v_date
        and e.amount_minor = v_amount
        and e.spent_by_user_id = v_participant
        and private.normalize_import_description(e.description_raw) = private.normalize_import_description(v_description)
    ) then
      v_is_duplicate := true;
    end if;

    if v_is_duplicate then
      v_duplicates := array_append(v_duplicates, v_row_number);
    end if;
    v_seen := array_append(v_seen, v_fingerprint);
  end loop;

  return jsonb_build_object(
    'fileAlreadyImported', v_file_exists,
    'duplicateRowNumbers', to_jsonb(v_duplicates)
  );
end;
$$;

revoke all on function public.preview_financial_import(uuid,public.import_target_kind,text,jsonb) from public;
grant execute on function public.preview_financial_import(uuid,public.import_target_kind,text,jsonb) to authenticated;

create or replace function public.commit_financial_import(
  p_goal_id uuid,
  p_target_kind public.import_target_kind,
  p_file_name text,
  p_file_type text,
  p_file_sha256 text,
  p_mapping jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_currency char(3);
  v_import_id uuid;
  v_import_row_id uuid;
  v_row jsonb;
  v_row_number integer;
  v_date date;
  v_amount bigint;
  v_description text;
  v_participant uuid;
  v_type text;
  v_category uuid;
  v_discretionary boolean;
  v_analytics public.analytics_status;
  v_selected boolean;
  v_error_code text;
  v_fingerprint text;
  v_duplicate boolean;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not private.is_goal_writable_member(p_goal_id) then raise exception 'goal is not writable'; end if;
  if p_file_type not in ('csv', 'xlsx') then raise exception 'unsupported file type'; end if;
  if p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid file hash'; end if;
  if char_length(trim(p_file_name)) < 1 or char_length(p_file_name) > 255 then raise exception 'invalid file name'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 1000 then raise exception 'invalid import row count'; end if;

  select g.currency_code into v_currency
  from public.goals g
  where g.id = p_goal_id and g.deleted_at is null and g.status <> 'archived';
  if v_currency is null then raise exception 'goal not available'; end if;

  if exists(select 1 from public.imports i where i.goal_id = p_goal_id and i.file_sha256 = p_file_sha256) then
    raise exception 'file_already_imported';
  end if;

  insert into public.imports(
    goal_id, created_by, target_kind, file_name, file_type, file_sha256, mapping_json,
    status, total_rows, accepted_rows, duplicate_rows
  ) values (
    p_goal_id, v_user_id, p_target_kind, trim(p_file_name), p_file_type, p_file_sha256,
    coalesce(p_mapping, '{}'::jsonb), 'preview', jsonb_array_length(p_rows), 0, 0
  ) returning id into v_import_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_row_number := (v_row->>'rowNumber')::integer;
    v_error_code := nullif(v_row->>'errorCode', '');
    v_selected := coalesce((v_row->>'selected')::boolean, false);

    if v_error_code is not null then
      insert into public.import_rows(import_id, row_number, normalized_json, status, error_code)
      values (v_import_id, v_row_number, v_row, 'error', left(v_error_code, 120));
      v_errors := v_errors + 1;
      continue;
    end if;

    v_date := (v_row->>'normalizedDate')::date;
    v_amount := (v_row->>'amountMinor')::bigint;
    v_description := trim(coalesce(v_row->>'description', ''));
    v_participant := (v_row->>'participantUserId')::uuid;
    if char_length(v_description) < 1 or char_length(v_description) > 500 then raise exception 'invalid description'; end if;
    if v_amount = 0 then raise exception 'zero amount is not allowed'; end if;
    if not exists (
      select 1 from public.goal_members gm
      where gm.goal_id = p_goal_id and gm.user_id = v_participant and gm.status = 'active'
    ) then raise exception 'participant is not an active goal member'; end if;

    v_type := case when p_target_kind = 'savings' then v_row->>'savingsType' else 'expense' end;
    if p_target_kind = 'savings' then
      if v_amount <= 0 then raise exception 'savings amount must be positive'; end if;
      if v_type not in ('contribution','interest','withdrawal','fee') then raise exception 'unsupported imported savings type'; end if;
    end if;

    if p_target_kind = 'expenses' then
      v_category := (v_row->>'categoryId')::uuid;
      v_discretionary := coalesce((v_row->>'isDiscretionary')::boolean, false);
      v_analytics := coalesce(nullif(v_row->>'analyticsStatus',''), 'included')::public.analytics_status;
      if not exists (
        select 1 from public.expense_categories c
        where c.id = v_category and c.archived_at is null and (c.goal_id is null or c.goal_id = p_goal_id)
      ) then raise exception 'invalid expense category'; end if;
    end if;

    v_fingerprint := private.import_fingerprint(p_goal_id, v_date, v_amount, v_description, v_participant, v_type);
    v_duplicate := exists (
      select 1 from public.import_rows ir
      join public.imports i on i.id = ir.import_id
      where i.goal_id = p_goal_id and ir.fingerprint = v_fingerprint and ir.status = 'accepted'
    );

    if not v_duplicate and p_target_kind = 'savings' then
      v_duplicate := exists (
        select 1 from public.savings_transactions s
        where s.goal_id = p_goal_id and s.deleted_at is null and s.transaction_date = v_date
          and s.amount_minor = v_amount and s.contributor_user_id = v_participant
          and s.type::text = v_type
          and private.normalize_import_description(s.description) = private.normalize_import_description(v_description)
      );
    elsif not v_duplicate and p_target_kind = 'expenses' then
      v_duplicate := exists (
        select 1 from public.expenses e
        where e.goal_id = p_goal_id and e.deleted_at is null and e.transaction_date = v_date
          and e.amount_minor = v_amount and e.spent_by_user_id = v_participant
          and private.normalize_import_description(e.description_raw) = private.normalize_import_description(v_description)
      );
    end if;

    if v_duplicate then
      insert into public.import_rows(import_id, row_number, normalized_date, normalized_amount_minor, normalized_description, normalized_json, fingerprint, status)
      values (v_import_id, v_row_number, v_date, v_amount, v_description, v_row, v_fingerprint, 'duplicate');
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    if not v_selected then
      insert into public.import_rows(import_id, row_number, normalized_date, normalized_amount_minor, normalized_description, normalized_json, fingerprint, status)
      values (v_import_id, v_row_number, v_date, v_amount, v_description, v_row, v_fingerprint, 'skipped');
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.import_rows(import_id, row_number, normalized_date, normalized_amount_minor, normalized_description, normalized_json, fingerprint, status)
    values (v_import_id, v_row_number, v_date, v_amount, v_description, v_row, v_fingerprint, 'accepted')
    returning id into v_import_row_id;

    if p_target_kind = 'savings' then
      insert into public.savings_transactions(
        goal_id, type, amount_minor, currency_code, transaction_date, contributor_user_id,
        description, source, import_row_id, created_by, updated_by
      ) values (
        p_goal_id, v_type::public.savings_transaction_type, v_amount, v_currency, v_date, v_participant,
        v_description, p_file_type::public.transaction_source, v_import_row_id, v_user_id, v_user_id
      );
    else
      insert into public.expenses(
        goal_id, amount_minor, currency_code, transaction_date, description_raw, merchant_normalized,
        category_id, spent_by_user_id, is_discretionary, analytics_status, source, import_row_id,
        created_by, updated_by
      ) values (
        p_goal_id, v_amount, v_currency, v_date, v_description, v_description,
        v_category, v_participant, v_discretionary, v_analytics, p_file_type::public.transaction_source,
        v_import_row_id, v_user_id, v_user_id
      );
    end if;

    v_accepted := v_accepted + 1;
  end loop;

  update public.imports
  set status = 'committed', accepted_rows = v_accepted, duplicate_rows = v_duplicates, committed_at = now()
  where id = v_import_id;

  return jsonb_build_object(
    'importId', v_import_id,
    'acceptedRows', v_accepted,
    'duplicateRows', v_duplicates,
    'skippedRows', v_skipped,
    'errorRows', v_errors
  );
end;
$$;

revoke all on function public.commit_financial_import(uuid,public.import_target_kind,text,text,text,jsonb,jsonb) from public;
grant execute on function public.commit_financial_import(uuid,public.import_target_kind,text,text,text,jsonb,jsonb) to authenticated;

-- ============================================================================
-- END: 202608310004_import_commit.sql
-- ============================================================================

-- ============================================================================
-- BEGIN: 202608310005_fix_category_names.sql
-- ============================================================================
-- Repair system category names that may have been corrupted by Windows PowerShell 5.1 encoding.
-- This migration is intentionally ASCII-only; PostgreSQL decodes U& Unicode escapes itself.

update public.expense_categories
set name = case key
  when 'groceries' then U&'\041F\0440\043E\0434\0443\043A\0442\044B'
  when 'cafes' then U&'\041A\0430\0444\0435 \0438 \0440\0435\0441\0442\043E\0440\0430\043D\044B'
  when 'transport' then U&'\0422\0440\0430\043D\0441\043F\043E\0440\0442'
  when 'housing' then U&'\0416\0438\043B\044C\0451 \0438 \043A\043E\043C\043C\0443\043D\0430\043B\044C\043D\044B\0435 \0443\0441\043B\0443\0433\0438'
  when 'health' then U&'\0417\0434\043E\0440\043E\0432\044C\0435 \0438 \0430\043F\0442\0435\043A\0438'
  when 'beauty' then U&'\041A\0440\0430\0441\043E\0442\0430 \0438 \0443\0445\043E\0434'
  when 'shopping' then U&'\041E\0434\0435\0436\0434\0430 \0438 \043F\043E\043A\0443\043F\043A\0438'
  when 'subscriptions' then U&'\041F\043E\0434\043F\0438\0441\043A\0438 \0438 \0441\0432\044F\0437\044C'
  when 'entertainment' then U&'\0420\0430\0437\0432\043B\0435\0447\0435\043D\0438\044F'
  when 'education' then U&'\041E\0431\0440\0430\0437\043E\0432\0430\043D\0438\0435'
  when 'travel' then U&'\041F\0443\0442\0435\0448\0435\0441\0442\0432\0438\044F'
  when 'pets' then U&'\041F\0438\0442\043E\043C\0446\044B'
  when 'gifts' then U&'\041F\043E\0434\0430\0440\043A\0438 \0438 \043F\043E\043C\043E\0449\044C'
  when 'taxes_fees' then U&'\041D\0430\043B\043E\0433\0438 \0438 \043A\043E\043C\0438\0441\0441\0438\0438'
  when 'transfers' then U&'\041F\0435\0440\0435\0432\043E\0434\044B'
  when 'cash' then U&'\041D\0430\043B\0438\0447\043D\044B\0435'
  when 'other' then U&'\0414\0440\0443\0433\043E\0435'
  when 'needs_review' then U&'\0422\0440\0435\0431\0443\0435\0442 \043F\0440\043E\0432\0435\0440\043A\0438'
  else name
end
where goal_id is null and is_system = true and key in (
  'groceries',
  'cafes',
  'transport',
  'housing',
  'health',
  'beauty',
  'shopping',
  'subscriptions',
  'entertainment',
  'education',
  'travel',
  'pets',
  'gifts',
  'taxes_fees',
  'transfers',
  'cash',
  'other',
  'needs_review'
);

-- ============================================================================
-- END: 202608310005_fix_category_names.sql
-- ============================================================================

-- ============================================================================
-- BEGIN: 202608310006_category_management.sql
-- ============================================================================
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

-- ============================================================================
-- END: 202608310006_category_management.sql
-- ============================================================================
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
