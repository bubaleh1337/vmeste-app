-- Stage 4.8: bank-agnostic duplicate protection for overlapping statements.
--
-- Principles:
-- 1) Exact file hashes still block re-importing the identical file.
-- 2) If a bank provides a stable transaction/reference ID, it becomes the
--    strongest identity signal.
-- 3) Otherwise operations are reconciled by content *with multiplicity*.
--    Two legitimate identical operations in one statement are preserved.
-- 4) When an account/IBAN/card scope can be detected, only its SHA-256 hash is
--    stored. Raw bank account identifiers are never stored by the importer.
-- 5) Unknown banks remain supported through the generic content identity.

alter table public.import_rows
  add column if not exists source_provider text,
  add column if not exists source_account_hash text,
  add column if not exists external_transaction_id text,
  add column if not exists identity_fingerprint text,
  add column if not exists content_fingerprint text;

alter table public.import_rows drop constraint if exists import_rows_source_account_hash_check;
alter table public.import_rows add constraint import_rows_source_account_hash_check
  check (source_account_hash is null or source_account_hash ~ '^[0-9a-f]{64}$');

alter table public.import_rows drop constraint if exists import_rows_source_provider_length_check;
alter table public.import_rows add constraint import_rows_source_provider_length_check
  check (source_provider is null or char_length(source_provider) between 1 and 120);

alter table public.import_rows drop constraint if exists import_rows_external_transaction_id_length_check;
alter table public.import_rows add constraint import_rows_external_transaction_id_length_check
  check (external_transaction_id is null or char_length(external_transaction_id) between 1 and 160);

create index if not exists import_rows_identity_fingerprint_idx
  on public.import_rows(identity_fingerprint)
  where identity_fingerprint is not null and status = 'accepted';
create index if not exists import_rows_content_fingerprint_idx
  on public.import_rows(content_fingerprint)
  where content_fingerprint is not null and status = 'accepted';
create index if not exists import_rows_external_transaction_idx
  on public.import_rows(source_provider, source_account_hash, external_transaction_id)
  where external_transaction_id is not null and status = 'accepted';

create or replace function private.normalize_import_identity_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(lower(trim(coalesce(p_value, ''))), 'ё', 'е'),
        '(\*|x){2,}[[:space:]-]*[0-9]{4}', ' card ', 'gi'
      ),
      '([0-9][[:space:]-]?){12,19}', ' account ', 'g'
    ),
    '[^0-9a-zа-я]+', ' ', 'g'
  ));
$$;

create or replace function private.import_content_fingerprint(
  p_goal_id uuid,
  p_transaction_date date,
  p_amount_minor bigint,
  p_currency text,
  p_direction text,
  p_description text
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
        upper(trim(coalesce(p_currency, ''))) || '|' || lower(trim(coalesce(p_direction, ''))) || '|' ||
        private.normalize_import_identity_text(p_description),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.import_identity_fingerprint(
  p_goal_id uuid,
  p_content_fingerprint text,
  p_source_provider text,
  p_source_account_hash text,
  p_external_transaction_id text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(trim(coalesce(p_external_transaction_id, '')), '') is not null then
      encode(extensions.digest(convert_to(
        p_goal_id::text || '|external|' || lower(trim(coalesce(p_source_provider, ''))) || '|' ||
        lower(trim(coalesce(p_source_account_hash, ''))) || '|' ||
        private.normalize_import_identity_text(p_external_transaction_id), 'UTF8'), 'sha256'), 'hex')
    when nullif(trim(coalesce(p_source_account_hash, '')), '') is not null then
      encode(extensions.digest(convert_to(
        p_goal_id::text || '|account|' || lower(trim(p_source_account_hash)) || '|' || p_content_fingerprint,
        'UTF8'), 'sha256'), 'hex')
    when nullif(trim(coalesce(p_source_provider, '')), '') is not null then
      encode(extensions.digest(convert_to(
        p_goal_id::text || '|provider|' || lower(trim(p_source_provider)) || '|' || p_content_fingerprint,
        'UTF8'), 'sha256'), 'hex')
    else p_content_fingerprint
  end;
$$;

revoke all on function private.normalize_import_identity_text(text) from public;
revoke all on function private.import_content_fingerprint(uuid,date,bigint,text,text,text) from public;
revoke all on function private.import_identity_fingerprint(uuid,text,text,text,text) from public;

-- Backfill immutable import rows from earlier releases so new overlapping
-- statements remain protected immediately after this migration.
update public.import_rows ir
set
  source_provider = coalesce(ir.source_provider, nullif(trim(ir.normalized_json->>'sourceProvider'), '')),
  source_account_hash = coalesce(ir.source_account_hash, nullif(trim(ir.normalized_json->>'sourceAccountHash'), '')),
  external_transaction_id = coalesce(ir.external_transaction_id, nullif(trim(ir.normalized_json->>'externalTransactionId'), ''))
where ir.status = 'accepted';

update public.import_rows ir
set content_fingerprint = private.import_content_fingerprint(
  i.goal_id,
  ir.normalized_date,
  ir.normalized_amount_minor,
  coalesce(nullif(ir.normalized_json->>'currencyCode', ''), g.currency_code),
  case
    when i.target_kind = 'expenses' then 'debit'
    when coalesce(ir.normalized_json->>'savingsType', '') in ('withdrawal', 'fee', 'adjustment_minus') then 'debit'
    else 'credit'
  end,
  coalesce(ir.normalized_description, ir.normalized_json->>'description', '')
)
from public.imports i
join public.goals g on g.id = i.goal_id
where ir.import_id = i.id
  and ir.status = 'accepted'
  and ir.normalized_date is not null
  and ir.normalized_amount_minor is not null
  and ir.content_fingerprint is null;

update public.import_rows ir
set identity_fingerprint = private.import_identity_fingerprint(
  i.goal_id,
  ir.content_fingerprint,
  ir.source_provider,
  ir.source_account_hash,
  ir.external_transaction_id
)
from public.imports i
where ir.import_id = i.id
  and ir.status = 'accepted'
  and ir.content_fingerprint is not null
  and ir.identity_fingerprint is null;

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
  v_goal_currency char(3);
  v_row jsonb;
  v_row_number integer;
  v_date date;
  v_amount bigint;
  v_description text;
  v_type text;
  v_currency char(3);
  v_direction text;
  v_provider text;
  v_account_hash text;
  v_external_id text;
  v_content_fp text;
  v_identity_fp text;
  v_occurrence integer;
  v_existing_count integer;
  v_legacy_count integer;
  v_manual_count integer;
  v_seen_counts jsonb := '{}'::jsonb;
  v_duplicates integer[] := array[]::integer[];
  v_is_duplicate boolean;
  v_file_exists boolean;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not private.is_goal_member(p_goal_id) then raise exception 'goal not available'; end if;
  if p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid file hash'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'too many import rows'; end if;

  select g.currency_code into v_goal_currency
  from public.goals g
  where g.id = p_goal_id and g.deleted_at is null;
  if v_goal_currency is null then raise exception 'goal not available'; end if;

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
    v_type := case when p_target_kind = 'savings' then v_row->>'savingsType' else 'expense' end;
    v_currency := upper(coalesce(nullif(v_row->>'currencyCode', ''), v_goal_currency));
    v_provider := nullif(lower(trim(coalesce(v_row->>'sourceProvider', ''))), '');
    v_account_hash := nullif(lower(trim(coalesce(v_row->>'sourceAccountHash', ''))), '');
    v_external_id := nullif(trim(coalesce(v_row->>'externalTransactionId', '')), '');
    if v_type is null then continue; end if;
    if v_currency not in ('KZT','EUR','USD','RUB') then continue; end if;
    if p_target_kind = 'expenses' and v_currency <> v_goal_currency then continue; end if;
    if v_account_hash is not null and v_account_hash !~ '^[0-9a-f]{64}$' then continue; end if;

    v_direction := case
      when p_target_kind = 'expenses' then 'debit'
      when v_type in ('withdrawal', 'fee', 'adjustment_minus') then 'debit'
      else 'credit'
    end;
    v_content_fp := private.import_content_fingerprint(
      p_goal_id, v_date, v_amount, v_currency, v_direction, v_description
    );
    v_identity_fp := private.import_identity_fingerprint(
      p_goal_id, v_content_fp, v_provider, v_account_hash, v_external_id
    );

    v_occurrence := coalesce((v_seen_counts->>v_identity_fp)::integer, 0) + 1;
    v_seen_counts := jsonb_set(v_seen_counts, array[v_identity_fp], to_jsonb(v_occurrence), true);

    if v_external_id is not null then
      select count(*)::integer into v_existing_count
      from public.import_rows ir
      join public.imports i on i.id = ir.import_id
      where i.goal_id = p_goal_id and i.status = 'committed'
        and ir.status = 'accepted' and ir.identity_fingerprint = v_identity_fp;
      v_is_duplicate := v_existing_count > 0 or v_occurrence > 1;
    else
      if v_provider is not null or v_account_hash is not null then
        select count(*)::integer into v_existing_count
        from public.import_rows ir
        join public.imports i on i.id = ir.import_id
        where i.goal_id = p_goal_id and i.status = 'committed'
          and ir.status = 'accepted' and ir.identity_fingerprint = v_identity_fp;

        -- Compatibility with rows imported before source/account scoping existed.
        select count(*)::integer into v_legacy_count
        from public.import_rows ir
        join public.imports i on i.id = ir.import_id
        where i.goal_id = p_goal_id and i.status = 'committed'
          and ir.status = 'accepted'
          and ir.source_provider is null and ir.source_account_hash is null
          and ir.content_fingerprint = v_content_fp;
      else
        select count(*)::integer into v_existing_count
        from public.import_rows ir
        join public.imports i on i.id = ir.import_id
        where i.goal_id = p_goal_id and i.status = 'committed'
          and ir.status = 'accepted' and ir.content_fingerprint = v_content_fp;
        v_legacy_count := 0;
      end if;

      if p_target_kind = 'savings' then
        select count(*)::integer into v_manual_count
        from public.savings_transactions s
        where s.goal_id = p_goal_id and s.deleted_at is null and s.import_row_id is null
          and s.transaction_date = v_date and s.amount_minor = v_amount and s.currency_code = v_currency
          and (case when s.type::text in ('withdrawal','fee','adjustment_minus') then 'debit' else 'credit' end) = v_direction
          and private.normalize_import_identity_text(s.description) = private.normalize_import_identity_text(v_description);
      else
        select count(*)::integer into v_manual_count
        from public.expenses e
        where e.goal_id = p_goal_id and e.deleted_at is null and e.import_row_id is null
          and e.transaction_date = v_date and e.amount_minor = v_amount and e.currency_code = v_currency
          and private.normalize_import_identity_text(e.description_raw) = private.normalize_import_identity_text(v_description);
      end if;

      v_is_duplicate := v_occurrence <= (coalesce(v_existing_count, 0) + coalesce(v_legacy_count, 0) + coalesce(v_manual_count, 0));
    end if;

    if v_is_duplicate then
      v_duplicates := array_append(v_duplicates, v_row_number);
    end if;
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
  v_goal_currency char(3);
  v_row_currency char(3);
  v_import_id uuid;
  v_import_row_id uuid;
  v_row jsonb;
  v_row_number integer;
  v_date date;
  v_amount bigint;
  v_description text;
  v_participant uuid;
  v_type text;
  v_direction text;
  v_category uuid;
  v_discretionary boolean;
  v_analytics public.analytics_status;
  v_selected boolean;
  v_error_code text;
  v_provider text;
  v_account_hash text;
  v_external_id text;
  v_content_fp text;
  v_identity_fp text;
  v_occurrence integer;
  v_existing_count integer;
  v_legacy_count integer;
  v_manual_count integer;
  v_seen_counts jsonb := '{}'::jsonb;
  v_duplicate boolean;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not private.is_goal_writable_member(p_goal_id) then raise exception 'goal is not writable'; end if;
  if p_file_type not in ('csv', 'xlsx', 'pdf') then raise exception 'unsupported file type'; end if;
  if p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid file hash'; end if;
  if char_length(trim(p_file_name)) < 1 or char_length(p_file_name) > 255 then raise exception 'invalid file name'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 1000 then raise exception 'invalid import row count'; end if;

  select g.currency_code into v_goal_currency
  from public.goals g
  where g.id = p_goal_id and g.deleted_at is null and g.status <> 'archived';
  if v_goal_currency is null then raise exception 'goal not available'; end if;

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
    v_row_currency := upper(coalesce(nullif(v_row->>'currencyCode', ''), v_goal_currency));
    v_provider := nullif(lower(trim(coalesce(v_row->>'sourceProvider', ''))), '');
    v_account_hash := nullif(lower(trim(coalesce(v_row->>'sourceAccountHash', ''))), '');
    v_external_id := nullif(trim(coalesce(v_row->>'externalTransactionId', '')), '');
    if v_row_currency not in ('KZT','EUR','USD','RUB') then raise exception 'unsupported transaction currency'; end if;
    if v_account_hash is not null and v_account_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid source account hash'; end if;
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
    else
      if v_row_currency <> v_goal_currency then raise exception 'expense currency must match goal currency'; end if;
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

    v_direction := case
      when p_target_kind = 'expenses' then 'debit'
      when v_type in ('withdrawal', 'fee', 'adjustment_minus') then 'debit'
      else 'credit'
    end;
    v_content_fp := private.import_content_fingerprint(
      p_goal_id, v_date, v_amount, v_row_currency, v_direction, v_description
    );
    v_identity_fp := private.import_identity_fingerprint(
      p_goal_id, v_content_fp, v_provider, v_account_hash, v_external_id
    );
    v_occurrence := coalesce((v_seen_counts->>v_identity_fp)::integer, 0) + 1;
    v_seen_counts := jsonb_set(v_seen_counts, array[v_identity_fp], to_jsonb(v_occurrence), true);

    if v_external_id is not null then
      select count(*)::integer into v_existing_count
      from public.import_rows ir
      join public.imports i on i.id = ir.import_id
      where i.goal_id = p_goal_id and i.status = 'committed'
        and ir.status = 'accepted' and ir.identity_fingerprint = v_identity_fp;
      v_duplicate := v_existing_count > 0 or v_occurrence > 1;
    else
      if v_provider is not null or v_account_hash is not null then
        select count(*)::integer into v_existing_count
        from public.import_rows ir
        join public.imports i on i.id = ir.import_id
        where i.goal_id = p_goal_id and i.status = 'committed'
          and ir.status = 'accepted' and ir.identity_fingerprint = v_identity_fp;
        select count(*)::integer into v_legacy_count
        from public.import_rows ir
        join public.imports i on i.id = ir.import_id
        where i.goal_id = p_goal_id and i.status = 'committed'
          and ir.status = 'accepted'
          and ir.source_provider is null and ir.source_account_hash is null
          and ir.content_fingerprint = v_content_fp;
      else
        select count(*)::integer into v_existing_count
        from public.import_rows ir
        join public.imports i on i.id = ir.import_id
        where i.goal_id = p_goal_id and i.status = 'committed'
          and ir.status = 'accepted' and ir.content_fingerprint = v_content_fp;
        v_legacy_count := 0;
      end if;

      if p_target_kind = 'savings' then
        select count(*)::integer into v_manual_count
        from public.savings_transactions s
        where s.goal_id = p_goal_id and s.deleted_at is null and s.import_row_id is null
          and s.transaction_date = v_date and s.amount_minor = v_amount and s.currency_code = v_row_currency
          and (case when s.type::text in ('withdrawal','fee','adjustment_minus') then 'debit' else 'credit' end) = v_direction
          and private.normalize_import_identity_text(s.description) = private.normalize_import_identity_text(v_description);
      else
        select count(*)::integer into v_manual_count
        from public.expenses e
        where e.goal_id = p_goal_id and e.deleted_at is null and e.import_row_id is null
          and e.transaction_date = v_date and e.amount_minor = v_amount and e.currency_code = v_row_currency
          and private.normalize_import_identity_text(e.description_raw) = private.normalize_import_identity_text(v_description);
      end if;

      v_duplicate := v_occurrence <= (coalesce(v_existing_count, 0) + coalesce(v_legacy_count, 0) + coalesce(v_manual_count, 0));
    end if;

    if v_duplicate then
      insert into public.import_rows(
        import_id, row_number, normalized_date, normalized_amount_minor, normalized_description, normalized_json,
        fingerprint, identity_fingerprint, content_fingerprint, source_provider, source_account_hash,
        external_transaction_id, status
      ) values (
        v_import_id, v_row_number, v_date, v_amount, v_description, v_row,
        v_identity_fp, v_identity_fp, v_content_fp, v_provider, v_account_hash, v_external_id, 'duplicate'
      );
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    if not v_selected then
      insert into public.import_rows(
        import_id, row_number, normalized_date, normalized_amount_minor, normalized_description, normalized_json,
        fingerprint, identity_fingerprint, content_fingerprint, source_provider, source_account_hash,
        external_transaction_id, status
      ) values (
        v_import_id, v_row_number, v_date, v_amount, v_description, v_row,
        v_identity_fp, v_identity_fp, v_content_fp, v_provider, v_account_hash, v_external_id, 'skipped'
      );
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.import_rows(
      import_id, row_number, normalized_date, normalized_amount_minor, normalized_description, normalized_json,
      fingerprint, identity_fingerprint, content_fingerprint, source_provider, source_account_hash,
      external_transaction_id, status
    ) values (
      v_import_id, v_row_number, v_date, v_amount, v_description, v_row,
      v_identity_fp, v_identity_fp, v_content_fp, v_provider, v_account_hash, v_external_id, 'accepted'
    ) returning id into v_import_row_id;

    if p_target_kind = 'savings' then
      insert into public.savings_transactions(
        goal_id, type, amount_minor, currency_code, transaction_date, contributor_user_id,
        description, source, import_row_id, created_by, updated_by
      ) values (
        p_goal_id, v_type::public.savings_transaction_type, v_amount, v_row_currency, v_date, v_participant,
        v_description, p_file_type::public.transaction_source, v_import_row_id, v_user_id, v_user_id
      );
    else
      insert into public.expenses(
        goal_id, amount_minor, currency_code, transaction_date, description_raw, merchant_normalized,
        category_id, spent_by_user_id, is_discretionary, analytics_status, source, import_row_id,
        created_by, updated_by
      ) values (
        p_goal_id, v_amount, v_goal_currency, v_date, v_description, v_description,
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
