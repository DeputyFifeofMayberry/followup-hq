-- Phase 3: revision-aware, conflict-aware authoritative save behavior.

alter table if exists public.follow_up_items
  add column if not exists record_version bigint not null default 1,
  add column if not exists updated_by_device text,
  add column if not exists last_batch_id text,
  add column if not exists last_operation_at timestamptz,
  add column if not exists conflict_marker boolean not null default false;

alter table if exists public.tasks
  add column if not exists record_version bigint not null default 1,
  add column if not exists updated_by_device text,
  add column if not exists last_batch_id text,
  add column if not exists last_operation_at timestamptz,
  add column if not exists conflict_marker boolean not null default false;

alter table if exists public.projects
  add column if not exists record_version bigint not null default 1,
  add column if not exists updated_by_device text,
  add column if not exists last_batch_id text,
  add column if not exists last_operation_at timestamptz,
  add column if not exists conflict_marker boolean not null default false;

alter table if exists public.contacts
  add column if not exists record_version bigint not null default 1,
  add column if not exists updated_by_device text,
  add column if not exists last_batch_id text,
  add column if not exists last_operation_at timestamptz,
  add column if not exists conflict_marker boolean not null default false;

alter table if exists public.companies
  add column if not exists record_version bigint not null default 1,
  add column if not exists updated_by_device text,
  add column if not exists last_batch_id text,
  add column if not exists last_operation_at timestamptz,
  add column if not exists conflict_marker boolean not null default false;

create index if not exists follow_up_items_user_record_version_idx on public.follow_up_items (user_id, record_version);
create index if not exists tasks_user_record_version_idx on public.tasks (user_id, record_version);
create index if not exists projects_user_record_version_idx on public.projects (user_id, record_version);
create index if not exists contacts_user_record_version_idx on public.contacts (user_id, record_version);
create index if not exists companies_user_record_version_idx on public.companies (user_id, record_version);

create index if not exists follow_up_items_user_conflict_marker_idx on public.follow_up_items (user_id, conflict_marker) where conflict_marker = true;
create index if not exists tasks_user_conflict_marker_idx on public.tasks (user_id, conflict_marker) where conflict_marker = true;
create index if not exists projects_user_conflict_marker_idx on public.projects (user_id, conflict_marker) where conflict_marker = true;
create index if not exists contacts_user_conflict_marker_idx on public.contacts (user_id, conflict_marker) where conflict_marker = true;
create index if not exists companies_user_conflict_marker_idx on public.companies (user_id, conflict_marker) where conflict_marker = true;

create table if not exists public.persistence_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity text not null,
  record_id text not null,
  local_batch_id text,
  cloud_batch_id text,
  local_device_id text,
  cloud_device_id text,
  local_record_version bigint,
  cloud_record_version bigint,
  conflict_type text not null,
  local_snapshot jsonb,
  cloud_snapshot jsonb,
  summary text not null,
  technical_detail text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint persistence_conflicts_status_check check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  constraint persistence_conflicts_type_check check (conflict_type in ('stale_write','concurrent_edit','edit_vs_delete','delete_vs_edit','delete_vs_delete_mismatch','auxiliary_conflict','revision_mismatch'))
);

create index if not exists persistence_conflicts_user_status_created_idx on public.persistence_conflicts (user_id, status, created_at desc);
create index if not exists persistence_conflicts_user_entity_record_idx on public.persistence_conflicts (user_id, entity, record_id);
create index if not exists persistence_conflicts_user_updated_idx on public.persistence_conflicts (user_id, updated_at desc);

alter table public.persistence_conflicts enable row level security;

drop policy if exists "persistence_conflicts owner select" on public.persistence_conflicts;
create policy "persistence_conflicts owner select" on public.persistence_conflicts
  for select using (auth.uid() = user_id);

drop policy if exists "persistence_conflicts owner update" on public.persistence_conflicts;
create policy "persistence_conflicts owner update" on public.persistence_conflicts
  for update using (auth.uid() = user_id);

drop policy if exists "persistence_conflicts owner insert" on public.persistence_conflicts;
create policy "persistence_conflicts owner insert" on public.persistence_conflicts
  for insert with check (auth.uid() = user_id);

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
  v_client_payload_hash text;
  v_server_payload_hash text;
  v_operation_count integer;
  v_operation_counts jsonb;
  v_device_id text;
  v_session_id text;
  v_existing record;
  v_receipt jsonb;
  v_touched_tables text[] := '{}';
  v_entity text;
  v_operation text;
  v_record_id text;
  v_record_snapshot jsonb;
  v_deleted_at timestamptz;
  v_expected_record_version bigint;
  v_expected_deleted_at timestamptz;
  v_expected_last_batch_id text;
  v_table text;
  v_current jsonb;
  v_current_version bigint;
  v_current_deleted_at timestamptz;
  v_current_last_batch_id text;
  v_current_device_id text;
  v_conflicts jsonb := '[]'::jsonb;
  v_conflict_id uuid;
  v_conflict_type text;
  v_conflict_summary text;
  v_conflict_detail text;
  v_conflict_count integer := 0;
  op record;
begin
  if v_user_id is null then
    raise exception using message = 'apply_save_batch requires an authenticated user', errcode = '28000';
  end if;

  v_batch_id := coalesce(batch->>'batchId', batch->>'batch_id');
  v_schema_version := nullif(batch->>'schemaVersion', '')::integer;
  v_operations := coalesce(batch->'operations', '[]'::jsonb);
  v_client_payload_hash := coalesce(batch->>'clientPayloadHash', batch->>'client_payload_hash');
  v_device_id := coalesce(batch->>'deviceId', batch->>'device_id');
  v_session_id := coalesce(batch->>'sessionId', batch->>'session_id');
  v_operation_counts := coalesce(batch->'operationCountsByEntity', batch->'operation_counts_by_entity', '{}'::jsonb);

  v_operation_count := jsonb_array_length(v_operations);
  v_server_payload_hash := encode(digest((jsonb_build_object('schemaVersion', v_schema_version,'operations', v_operations,'operationCount', v_operation_count,'operationCountsByEntity', v_operation_counts))::text, 'sha256'),'hex');

  select * into v_existing from public.save_batches where user_id = v_user_id and batch_id = v_batch_id for update;

  if found and v_existing.status = 'committed' then
    return coalesce(v_existing.result_summary, '{}'::jsonb);
  end if;

  if found then
    update public.save_batches
      set status = 'received',
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
  else
    insert into public.save_batches (batch_id,user_id,device_id,session_id,status,schema_version,client_payload_hash,server_payload_hash,operation_count,received_at)
    values (v_batch_id,v_user_id,v_device_id,v_session_id,'received',v_schema_version,v_client_payload_hash,v_server_payload_hash,v_operation_count,now());
  end if;

  -- strict all-or-nothing conflict detection before mutating rows
  for op in select value as operation_entry from jsonb_array_elements(v_operations)
  loop
    v_entity := op.operation_entry->>'entity';
    v_operation := op.operation_entry->>'operation';
    v_record_id := op.operation_entry->>'recordId';
    v_record_snapshot := op.operation_entry->'recordSnapshot';
    v_deleted_at := nullif(op.operation_entry->>'deletedAt', '')::timestamptz;
    v_expected_record_version := nullif(op.operation_entry->>'expectedRecordVersion', '')::bigint;
    v_expected_deleted_at := nullif(op.operation_entry->>'expectedDeletedAt', '')::timestamptz;
    v_expected_last_batch_id := nullif(op.operation_entry->>'expectedLastBatchId', '');

    v_table := case v_entity
      when 'items' then 'follow_up_items'
      when 'tasks' then 'tasks'
      when 'projects' then 'projects'
      when 'contacts' then 'contacts'
      when 'companies' then 'companies'
      else null
    end;

    if v_table is null then
      raise exception using message = format('apply_save_batch validation failed: unsupported entity %s', coalesce(v_entity, 'null')), errcode = '22023';
    end if;

    execute format('select to_jsonb(t) from public.%I t where t.user_id = $1 and t.record_id = $2', v_table)
      into v_current
      using v_user_id, v_record_id;

    if v_current is null then
      v_current_version := null;
      v_current_deleted_at := null;
      v_current_last_batch_id := null;
      v_current_device_id := null;
    else
      v_current_version := nullif(v_current->>'record_version', '')::bigint;
      v_current_deleted_at := nullif(v_current->>'deleted_at', '')::timestamptz;
      v_current_last_batch_id := nullif(v_current->>'last_batch_id', '');
      v_current_device_id := nullif(v_current->>'updated_by_device', '');
    end if;

    v_conflict_type := null;
    if v_expected_record_version is not null then
      if v_current is null then
        v_conflict_type := 'stale_write';
        v_conflict_summary := 'Client expected record to exist but cloud row is missing.';
      elsif v_current_version <> v_expected_record_version then
        if v_operation = 'delete' and v_current_deleted_at is null then
          v_conflict_type := 'delete_vs_edit';
        elsif v_operation = 'upsert' and v_current_deleted_at is not null then
          v_conflict_type := 'edit_vs_delete';
        else
          v_conflict_type := 'revision_mismatch';
        end if;
        v_conflict_summary := format('Expected version %s but cloud version is %s.', v_expected_record_version, coalesce(v_current_version::text, 'null'));
      elsif coalesce(v_expected_deleted_at, to_timestamp(0)) is distinct from coalesce(v_current_deleted_at, to_timestamp(0)) then
        v_conflict_type := case when v_operation = 'delete' then 'delete_vs_delete_mismatch' else 'concurrent_edit' end;
        v_conflict_summary := 'Delete tombstone expectation did not match cloud state.';
      elsif v_expected_last_batch_id is not null and v_current_last_batch_id is distinct from v_expected_last_batch_id then
        v_conflict_type := 'concurrent_edit';
        v_conflict_summary := 'Cloud batch lineage advanced since local base revision.';
      end if;
    end if;

    if v_conflict_type is not null then
      v_conflict_detail := format('entity=%s record=%s op=%s expected_version=%s cloud_version=%s expected_deleted=%s cloud_deleted=%s local_batch=%s cloud_batch=%s',
        v_entity,
        v_record_id,
        v_operation,
        coalesce(v_expected_record_version::text, 'null'),
        coalesce(v_current_version::text, 'null'),
        coalesce(v_expected_deleted_at::text, 'null'),
        coalesce(v_current_deleted_at::text, 'null'),
        coalesce(v_batch_id, 'null'),
        coalesce(v_current_last_batch_id, 'null')
      );

      insert into public.persistence_conflicts (
        user_id, entity, record_id, local_batch_id, cloud_batch_id, local_device_id, cloud_device_id,
        local_record_version, cloud_record_version, conflict_type, local_snapshot, cloud_snapshot,
        summary, technical_detail, status
      ) values (
        v_user_id, v_entity, v_record_id, v_batch_id, v_current_last_batch_id, v_device_id, v_current_device_id,
        v_expected_record_version, v_current_version, v_conflict_type, v_record_snapshot, v_current,
        v_conflict_summary, v_conflict_detail, 'open'
      ) returning id into v_conflict_id;

      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'id', v_conflict_id,
        'entity', v_entity,
        'recordId', v_record_id,
        'type', v_conflict_type
      ));
      v_conflict_count := v_conflict_count + 1;
    end if;
  end loop;

  if v_conflict_count > 0 then
    v_receipt := jsonb_build_object(
      'batchId', v_batch_id,
      'userId', v_user_id,
      'status', 'conflict',
      'committedAt', null,
      'schemaVersion', v_schema_version,
      'operationCount', v_operation_count,
      'appliedOperationCount', 0,
      'conflictedOperationCount', v_conflict_count,
      'operationCountsByEntity', v_operation_counts,
      'touchedTables', coalesce(v_touched_tables, '{}'),
      'clientPayloadHash', v_client_payload_hash,
      'serverPayloadHash', v_server_payload_hash,
      'hashMatch', v_client_payload_hash is not null and v_client_payload_hash = v_server_payload_hash,
      'conflictIds', (select coalesce(jsonb_agg(entry->>'id'), '[]'::jsonb) from jsonb_array_elements(v_conflicts) as entry),
      'conflictCountByEntity', (select coalesce(jsonb_object_agg(entity, count), '{}'::jsonb) from (select entry->>'entity' as entity, count(*)::int as count from jsonb_array_elements(v_conflicts) as entry group by entry->>'entity') grouped),
      'conflictCountByType', (select coalesce(jsonb_object_agg(type, count), '{}'::jsonb) from (select entry->>'type' as type, count(*)::int as count from jsonb_array_elements(v_conflicts) as entry group by entry->>'type') grouped),
      'outboxSafeToClear', false
    );

    update public.save_batches
      set status = 'rejected', result_summary = v_receipt, error_summary = jsonb_build_object('reason', 'conflict_detected', 'conflictCount', v_conflict_count)
    where user_id = v_user_id and batch_id = v_batch_id;

    return v_receipt;
  end if;

  for op in select value as operation_entry from jsonb_array_elements(v_operations)
  loop
    v_entity := op.operation_entry->>'entity';
    v_operation := op.operation_entry->>'operation';
    v_record_id := op.operation_entry->>'recordId';
    v_record_snapshot := op.operation_entry->'recordSnapshot';
    v_deleted_at := nullif(op.operation_entry->>'deletedAt', '')::timestamptz;

    v_table := case v_entity
      when 'items' then 'follow_up_items'
      when 'tasks' then 'tasks'
      when 'projects' then 'projects'
      when 'contacts' then 'contacts'
      when 'companies' then 'companies'
    end;

    if v_operation = 'upsert' then
      execute format(
        'insert into public.%I (user_id, record_id, record, deleted_at, updated_at, record_version, updated_by_device, last_batch_id, last_operation_at, conflict_marker)
         values ($1, $2, $3, null, now(), 1, $4, $5, now(), false)
         on conflict (user_id, record_id)
         do update set record = excluded.record, deleted_at = null, updated_at = now(), record_version = %I.record_version + 1, updated_by_device = excluded.updated_by_device, last_batch_id = excluded.last_batch_id, last_operation_at = now(), conflict_marker = false',
        v_table,
        v_table
      ) using v_user_id, v_record_id, coalesce(v_record_snapshot, jsonb_build_object('id', v_record_id)), v_device_id, v_batch_id;
    else
      execute format(
        'insert into public.%I (user_id, record_id, record, deleted_at, updated_at, record_version, updated_by_device, last_batch_id, last_operation_at, conflict_marker)
         values ($1, $2, $3, $4, now(), 1, $5, $6, now(), false)
         on conflict (user_id, record_id)
         do update set record = excluded.record, deleted_at = excluded.deleted_at, updated_at = now(), record_version = %I.record_version + 1, updated_by_device = excluded.updated_by_device, last_batch_id = excluded.last_batch_id, last_operation_at = now(), conflict_marker = false',
        v_table,
        v_table
      ) using v_user_id, v_record_id, coalesce(v_record_snapshot, jsonb_build_object('id', v_record_id)), coalesce(v_deleted_at, now()), v_device_id, v_batch_id;
    end if;

    if not (v_table = any(v_touched_tables)) then
      v_touched_tables := array_append(v_touched_tables, v_table);
    end if;
  end loop;

  v_receipt := jsonb_build_object(
    'batchId', v_batch_id,
    'userId', v_user_id,
    'status', 'committed',
    'committedAt', now(),
    'schemaVersion', v_schema_version,
    'operationCount', v_operation_count,
    'appliedOperationCount', v_operation_count,
    'conflictedOperationCount', 0,
    'operationCountsByEntity', v_operation_counts,
    'touchedTables', v_touched_tables,
    'clientPayloadHash', v_client_payload_hash,
    'serverPayloadHash', v_server_payload_hash,
    'hashMatch', v_client_payload_hash is not null and v_client_payload_hash = v_server_payload_hash,
    'outboxSafeToClear', true
  );

  update public.save_batches
    set status = 'committed',
      committed_at = (v_receipt->>'committedAt')::timestamptz,
      result_summary = v_receipt,
      error_summary = null
  where user_id = v_user_id and batch_id = v_batch_id;

  return v_receipt;
end;
$$;
