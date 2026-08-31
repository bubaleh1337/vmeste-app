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
  user_id uuid := (select auth.uid());
  invitation public.goal_invitations%rowtype;
begin
  if user_id is null then raise exception 'authentication required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation token'; end if;

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

  if invitation.id is null then raise exception 'invitation is invalid or expired'; end if;

  insert into public.goal_members(goal_id, user_id, role, status, joined_at, removed_at)
  values (invitation.goal_id, user_id, 'member', 'active', now(), null)
  on conflict (goal_id, user_id) do update
    set status = 'active', removed_at = null, joined_at = now(),
        role = case when public.goal_members.role = 'owner' then 'owner'::public.goal_role else 'member'::public.goal_role end;

  update public.goal_invitations
  set accepted_by = user_id, accepted_at = now()
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
  (null, 'groceries', 'Продукты', 'shopping-basket', '#6F806A', false, true),
  (null, 'cafes', 'Кафе и рестораны', 'utensils', '#C88F87', true, true),
  (null, 'transport', 'Транспорт', 'car', '#C2A15C', false, true),
  (null, 'housing', 'Жильё и коммунальные услуги', 'house', '#8F9B88', false, true),
  (null, 'health', 'Здоровье и аптеки', 'heart-pulse', '#A87972', false, true),
  (null, 'beauty', 'Красота и уход', 'sparkles', '#B69A8B', true, true),
  (null, 'shopping', 'Одежда и покупки', 'shirt', '#9A836C', true, true),
  (null, 'subscriptions', 'Подписки и связь', 'wifi', '#7C8B7B', true, true),
  (null, 'entertainment', 'Развлечения', 'ticket', '#B28B82', true, true),
  (null, 'education', 'Образование', 'book-open', '#A38E64', false, true),
  (null, 'travel', 'Путешествия', 'plane', '#87968B', true, true),
  (null, 'pets', 'Питомцы', 'paw-print', '#A77F78', false, true),
  (null, 'gifts', 'Подарки и помощь', 'gift', '#B79865', true, true),
  (null, 'taxes_fees', 'Налоги и комиссии', 'receipt-text', '#7E7A70', false, true),
  (null, 'transfers', 'Переводы', 'arrow-left-right', '#8B8B83', false, true),
  (null, 'cash', 'Наличные', 'banknote', '#9A9489', false, true),
  (null, 'other', 'Другое', 'circle-ellipsis', '#918A80', false, true),
  (null, 'needs_review', 'Требует проверки', 'circle-help', '#B85C4A', false, true);

commit;
