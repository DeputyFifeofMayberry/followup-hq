-- Phase 1 authoritative save batching: server-authoritative atomic save pipeline + durable receipts.

create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.save_batches (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null,
  user_id uuid not null,
  device_id text,
  session_id text,
  status text not null,
  schema_version integer not null,
  client_payload_hash text,
  server_payload_hash text,
  operation_count integer not null default 0,
  result_summary jsonb not null default '{}'::jsonb,
  error_summary jsonb,
  created_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  committed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint save_batches_user_batch_unique unique (user_id, batch_id),
  constraint save_batches_status_check check (status in ('received', 'committed', 'rejected'))
);

create index if not exists save_batches_user_committed_idx on public.save_batches (user_id, committed_at desc);
create index if not exists save_batches_user_created_idx on public.save_batches (user_id, created_at desc);

alter table public.save_batches enable row level security;

drop policy if exists "save_batches owner select" on public.save_batches;
create policy "save_batches owner select" on public.save_batches
  for select
  using (auth.uid() = user_id);

drop trigger if exists trg_save_batches_updated_at on public.save_batches;
create trigger trg_save_batches_updated_at
before update on public.save_batches
for each row
execute function public.set_row_updated_at();

create or replace function public.apply_save_batch(batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id text;
  v_schema_version integer;
  v_operations jsonb;
  v_auxiliary jsonb;
  v_client_payload_hash text;
  v_server_payload_hash text;
  v_operation_count integer;
  v_operation_counts jsonb;
  v_device_id text;
  v_session_id text;
  v_existing record;
  v_batch_row_id uuid;
  v_receipt jsonb;
  v_touched_tables text[] := '{}';
  v_entity text;
  v_operation text;
  v_record_id text;
  v_record_snapshot jsonb;
  v_deleted_at timestamptz;
  v_counts jsonb := jsonb_build_object(
    'items', jsonb_build_object('upserts', 0, 'deletes', 0),
    'tasks', jsonb_build_object('upserts', 0, 'deletes', 0),
    'projects', jsonb_build_object('upserts', 0, 'deletes', 0),
    'contacts', jsonb_build_object('upserts', 0, 'deletes', 0),
    'companies', jsonb_build_object('upserts', 0, 'deletes', 0)
  );
  v_table text;
  v_count_field text;
  v_error_code text;
  v_error_detail text;
  v_error_hint text;
  op record;
begin
  if v_user_id is null then
    raise exception using message = 'apply_save_batch requires an authenticated user', errcode = '28000';
  end if;

  v_batch_id := coalesce(batch->>'batchId', batch->>'batch_id');
  v_schema_version := nullif(batch->>'schemaVersion', '')::integer;
  v_operations := coalesce(batch->'operations', '[]'::jsonb);
  v_auxiliary := batch->'auxiliary';
  v_client_payload_hash := coalesce(batch->>'clientPayloadHash', batch->>'client_payload_hash');
  v_device_id := coalesce(batch->>'deviceId', batch->>'device_id');
  v_session_id := coalesce(batch->>'sessionId', batch->>'session_id');
  v_operation_counts := coalesce(batch->'operationCountsByEntity', batch->'operation_counts_by_entity', '{}'::jsonb);

  if v_batch_id is null or length(trim(v_batch_id)) = 0 then
    raise exception using message = 'apply_save_batch validation failed: batchId is required', errcode = '22023';
  end if;

  if v_schema_version is null then
    raise exception using message = 'apply_save_batch validation failed: schemaVersion is required', errcode = '22023';
  end if;

  if jsonb_typeof(v_operations) <> 'array' then
    raise exception using message = 'apply_save_batch validation failed: operations must be an array', errcode = '22023';
  end if;

  v_operation_count := jsonb_array_length(v_operations);

  v_server_payload_hash := encode(
    digest(
      (
        jsonb_build_object(
          'schemaVersion', v_schema_version,
          'operations', v_operations,
          'auxiliary', coalesce(v_auxiliary, 'null'::jsonb),
          'operationCount', v_operation_count,
          'operationCountsByEntity', v_operation_counts
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing
  from public.save_batches
  where user_id = v_user_id and batch_id = v_batch_id
  for update;

  if found and v_existing.status = 'committed' then
    return coalesce(v_existing.result_summary, '{}'::jsonb);
  end if;

  if found then
    update public.save_batches
    set
      status = 'received',
      schema_version = v_schema_version,
      client_payload_hash = v_client_payload_hash,
      server_payload_hash = v_server_payload_hash,
      operation_count = v_operation_count,
      received_at = now(),
      committed_at = null,
      error_summary = null,
      result_summary = '{}'::jsonb,
      device_id = coalesce(v_device_id, device_id),
      session_id = coalesce(v_session_id, session_id)
    where id = v_existing.id;
    v_batch_row_id := v_existing.id;
  else
    insert into public.save_batches (
      batch_id,
      user_id,
      device_id,
      session_id,
      status,
      schema_version,
      client_payload_hash,
      server_payload_hash,
      operation_count,
      received_at
    ) values (
      v_batch_id,
      v_user_id,
      v_device_id,
      v_session_id,
      'received',
      v_schema_version,
      v_client_payload_hash,
      v_server_payload_hash,
      v_operation_count,
      now()
    )
    returning id into v_batch_row_id;
  end if;

  for op in select value as operation_entry from jsonb_array_elements(v_operations)
  loop
    v_entity := op.operation_entry->>'entity';
    v_operation := op.operation_entry->>'operation';
    v_record_id := op.operation_entry->>'recordId';
    v_record_snapshot := op.operation_entry->'recordSnapshot';
    v_deleted_at := nullif(op.operation_entry->>'deletedAt', '')::timestamptz;

    if v_entity not in ('items', 'tasks', 'projects', 'contacts', 'companies') then
      raise exception using message = format('apply_save_batch validation failed: unsupported entity %s', coalesce(v_entity, 'null')), errcode = '22023';
    end if;

    if v_operation not in ('upsert', 'delete') then
      raise exception using message = format('apply_save_batch validation failed: unsupported operation %s', coalesce(v_operation, 'null')), errcode = '22023';
    end if;

    if v_record_id is null or length(trim(v_record_id)) = 0 then
      raise exception using message = 'apply_save_batch validation failed: operation recordId is required', errcode = '22023';
    end if;

    v_table := case v_entity
      when 'items' then 'follow_up_items'
      when 'tasks' then 'tasks'
      when 'projects' then 'projects'
      when 'contacts' then 'contacts'
      when 'companies' then 'companies'
    end;

    if v_operation = 'upsert' then
      execute format(
        'insert into public.%I (user_id, record_id, record, deleted_at, updated_at)
         values ($1, $2, $3, null, now())
         on conflict (user_id, record_id)
         do update set record = excluded.record, deleted_at = null, updated_at = now()',
        v_table
      ) using v_user_id, v_record_id, coalesce(v_record_snapshot, jsonb_build_object('id', v_record_id));
      v_count_field := 'upserts';
    else
      execute format(
        'insert into public.%I (user_id, record_id, record, deleted_at, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (user_id, record_id)
         do update set record = excluded.record, deleted_at = excluded.deleted_at, updated_at = now()',
        v_table
      ) using v_user_id, v_record_id, coalesce(v_record_snapshot, jsonb_build_object('id', v_record_id)), coalesce(v_deleted_at, now());
      v_count_field := 'deletes';
    end if;

    v_counts := jsonb_set(
      v_counts,
      array[v_entity, v_count_field],
      to_jsonb((coalesce((v_counts #>> array[v_entity, v_count_field])::integer, 0) + 1)),
      true
    );

    if not (v_table = any (v_touched_tables)) then
      v_touched_tables := array_append(v_touched_tables, v_table);
    end if;
  end loop;

  if v_auxiliary is not null then
    insert into public.user_preferences (user_id, auxiliary, migration_complete, updated_at)
    values (v_user_id, v_auxiliary, true, now())
    on conflict (user_id)
    do update set auxiliary = excluded.auxiliary, migration_complete = true, updated_at = now();

    if not ('user_preferences' = any (v_touched_tables)) then
      v_touched_tables := array_append(v_touched_tables, 'user_preferences');
    end if;
  end if;

  v_receipt := jsonb_build_object(
    'batchId', v_batch_id,
    'userId', v_user_id,
    'status', 'committed',
    'committedAt', now(),
    'schemaVersion', v_schema_version,
    'operationCount', v_operation_count,
    'operationCountsByEntity', v_counts,
    'touchedTables', to_jsonb(v_touched_tables),
    'clientPayloadHash', v_client_payload_hash,
    'serverPayloadHash', v_server_payload_hash,
    'hashMatch', v_client_payload_hash is not null and v_client_payload_hash = v_server_payload_hash
  );

  update public.save_batches
  set
    status = 'committed',
    committed_at = (v_receipt->>'committedAt')::timestamptz,
    result_summary = v_receipt,
    error_summary = null,
    server_payload_hash = v_server_payload_hash,
    operation_count = v_operation_count
  where id = v_batch_row_id;

  return v_receipt;
exception
  when others then
    get stacked diagnostics v_error_code = returned_sqlstate, v_error_detail = pg_exception_detail, v_error_hint = pg_exception_hint;
    if v_batch_row_id is not null then
      update public.save_batches
      set
        status = 'rejected',
        error_summary = jsonb_build_object(
          'code', v_error_code,
          'message', sqlerrm,
          'detail', v_error_detail,
          'hint', v_error_hint,
          'failedAt', now()
        )
      where id = v_batch_row_id;
    end if;

    raise exception using
      message = format('apply_save_batch failed for batch %s: %s', coalesce(v_batch_id, 'unknown'), sqlerrm),
      errcode = coalesce(v_error_code, 'P0001');
end;
$$;

revoke all on function public.apply_save_batch(jsonb) from public;
grant execute on function public.apply_save_batch(jsonb) to authenticated;
