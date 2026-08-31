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
