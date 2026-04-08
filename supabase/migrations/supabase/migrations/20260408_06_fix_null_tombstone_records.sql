-- Fix null tombstone records in apply_save_batch.
-- The prior function could write record = null for delete operations,
-- which violates the entity-table contract where record jsonb is NOT NULL.

insert into public.persistence_contract_meta (contract_name, contract_version, migration_signature, updated_at)
values ('entity_persistence_v2', '2026-04-08.6', '20260408_06_fix_null_tombstone_records', now())
on conflict (contract_name) do update
set contract_version = excluded.contract_version,
    migration_signature = excluded.migration_signature,
    updated_at = excluded.updated_at;

drop function if exists public.apply_save_batch(json);

create or replace function public.apply_save_batch(batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id text := nullif(coalesce(batch->>'batchId', batch->>'batch_id'), '');
  v_schema_version integer := nullif(batch->>'schemaVersion', '')::integer;
  v_operations jsonb := coalesce(batch->'operations', '[]'::jsonb);
  v_auxiliary jsonb := batch->'auxiliary';
  v_device_id text := nullif(coalesce(batch->>'deviceId', batch->>'device_id'), '');
  v_client_payload_hash text := nullif(coalesce(batch->>'clientPayloadHash', batch->>'client_payload_hash'), '');
  v_server_payload_hash text;
  v_committed_at timestamptz := now();
  v_operation_count integer;
  v_applied_count integer := 0;
  v_counts jsonb := jsonb_build_object(
    'items', jsonb_build_object('upserts', 0, 'deletes', 0),
    'tasks', jsonb_build_object('upserts', 0, 'deletes', 0),
    'projects', jsonb_build_object('upserts', 0, 'deletes', 0),
    'contacts', jsonb_build_object('upserts', 0, 'deletes', 0),
    'companies', jsonb_build_object('upserts', 0, 'deletes', 0)
  );
  v_touched_tables text[] := '{}';
  v_conflicts jsonb := '[]'::jsonb;
  v_entity text;
  v_operation text;
  v_record_id text;
  v_record jsonb;
  v_table text;
  v_count_field text;
  op record;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'apply_save_batch requires an authenticated user';
  end if;

  if v_batch_id is null then
    raise exception using errcode = '22023', message = 'apply_save_batch validation failed: batchId is required';
  end if;

  if v_schema_version is null then
    raise exception using errcode = '22023', message = 'apply_save_batch validation failed: schemaVersion is required';
  end if;

  if jsonb_typeof(v_operations) <> 'array' then
    raise exception using errcode = '22023', message = 'apply_save_batch validation failed: operations must be an array';
  end if;

  v_operation_count := jsonb_array_length(v_operations);
  v_server_payload_hash := md5(coalesce(jsonb_build_object(
    'batchId', v_batch_id,
    'schemaVersion', v_schema_version,
    'operations', v_operations,
    'auxiliary', coalesce(v_auxiliary, 'null'::jsonb)
  )::text, ''));

  for op in
    select value as operation_doc
    from jsonb_array_elements(v_operations)
  loop
    v_entity := op.operation_doc->>'entity';
    v_operation := lower(coalesce(op.operation_doc->>'op', op.operation_doc->>'operation', ''));
    v_record_id := coalesce(op.operation_doc->>'recordId', op.operation_doc->>'id');
    v_record := coalesce(op.operation_doc->'record', op.operation_doc->'recordSnapshot');

    if v_entity not in ('items', 'tasks', 'projects', 'contacts', 'companies') then
      raise exception using errcode = '22023', message = format(
        'apply_save_batch validation failed: unsupported entity %s',
        coalesce(v_entity, 'null')
      );
    end if;

    if v_operation not in ('upsert', 'delete') then
      raise exception using errcode = '22023', message = format(
        'apply_save_batch validation failed: unsupported operation %s',
        coalesce(v_operation, 'null')
      );
    end if;

    if v_record_id is null or btrim(v_record_id) = '' then
      raise exception using errcode = '22023', message = 'apply_save_batch validation failed: operation recordId is required';
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
        'insert into public.%I (
            user_id, record_id, record, deleted_at, updated_at, record_version,
            updated_by_device, last_batch_id, last_operation_at, conflict_marker
         )
         values ($1, $2, coalesce($3, ''{}''::jsonb), null, now(), 1, $4, $5, now(), false)
         on conflict (user_id, record_id) do update
         set record = excluded.record,
             deleted_at = null,
             updated_at = now(),
             record_version = coalesce(public.%I.record_version, 1) + 1,
             updated_by_device = excluded.updated_by_device,
             last_batch_id = excluded.last_batch_id,
             last_operation_at = now(),
             conflict_marker = false',
        v_table,
        v_table
      )
      using v_user_id, v_record_id, v_record, v_device_id, v_batch_id;

      v_count_field := 'upserts';
    else
      execute format(
        'insert into public.%I (
            user_id, record_id, record, deleted_at, updated_at, record_version,
            updated_by_device, last_batch_id, last_operation_at, conflict_marker
         )
         values (
            $1,
            $2,
            coalesce($3, jsonb_build_object(''id'', $2, ''_tombstone'', true)),
            now(),
            now(),
            1,
            $4,
            $5,
            now(),
            false
         )
         on conflict (user_id, record_id) do update
         set record = coalesce(public.%I.record, excluded.record),
             deleted_at = now(),
             updated_at = now(),
             record_version = coalesce(public.%I.record_version, 1) + 1,
             updated_by_device = excluded.updated_by_device,
             last_batch_id = excluded.last_batch_id,
             last_operation_at = now(),
             conflict_marker = false',
        v_table,
        v_table,
        v_table
      )
      using v_user_id, v_record_id, v_record, v_device_id, v_batch_id;

      v_count_field := 'deletes';
    end if;

    v_counts := jsonb_set(
      v_counts,
      array[v_entity, v_count_field],
      to_jsonb(coalesce((v_counts->v_entity->>v_count_field)::integer, 0) + 1),
      true
    );

    if not (v_table = any(v_touched_tables)) then
      v_touched_tables := array_append(v_touched_tables, v_table);
    end if;

    v_applied_count := v_applied_count + 1;
  end loop;

  if v_auxiliary is not null then
    insert into public.user_preferences (user_id, migration_complete, auxiliary, updated_at)
    values (v_user_id, coalesce((v_auxiliary->>'migrationComplete')::boolean, false), v_auxiliary, now())
    on conflict (user_id) do update
      set migration_complete = coalesce(
            (excluded.auxiliary->>'migrationComplete')::boolean,
            public.user_preferences.migration_complete
          ),
          auxiliary = excluded.auxiliary,
          updated_at = now();

    if not ('user_preferences' = any(v_touched_tables)) then
      v_touched_tables := array_append(v_touched_tables, 'user_preferences');
    end if;
  end if;

  return jsonb_build_object(
    'batchId', v_batch_id,
    'userId', v_user_id,
    'status', 'committed',
    'committedAt', v_committed_at,
    'schemaVersion', v_schema_version,
    'operationCount', v_operation_count,
    'appliedOperationCount', v_applied_count,
    'conflictedOperationCount', 0,
    'operationCountsByEntity', v_counts,
    'touchedTables', to_jsonb(v_touched_tables),
    'clientPayloadHash', v_client_payload_hash,
    'serverPayloadHash', v_server_payload_hash,
    'hashMatch', case
      when v_client_payload_hash is null then true
      else (v_client_payload_hash = v_server_payload_hash)
    end,
    'conflictIds', v_conflicts,
    'outboxSafeToClear', true
  );
end;
$$;

revoke all on function public.apply_save_batch(jsonb) from public;
grant execute on function public.apply_save_batch(jsonb) to authenticated;