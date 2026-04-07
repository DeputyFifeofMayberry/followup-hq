-- Align persistence contract with current client expectations.

create or replace function public.ensure_entity_persistence_table(table_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  constraint_name text;
begin
  execute format(
    'create table if not exists public.%I (
      user_id uuid not null,
      record_id text not null,
      record jsonb not null,
      deleted_at timestamptz,
      updated_at timestamptz not null default now(),
      record_version integer not null default 1,
      updated_by_device text,
      last_batch_id text,
      last_operation_at timestamptz,
      conflict_marker boolean not null default false,
      primary key (user_id, record_id)
    )',
    table_name
  );

  execute format('alter table public.%I add column if not exists user_id uuid', table_name);
  execute format('alter table public.%I alter column user_id set not null', table_name);

  execute format('alter table public.%I add column if not exists record_id text', table_name);
  execute format('alter table public.%I alter column record_id set not null', table_name);

  execute format('alter table public.%I add column if not exists record jsonb', table_name);
  execute format('update public.%I set record = jsonb_build_object(''id'', record_id) where record is null', table_name);
  execute format('alter table public.%I alter column record set not null', table_name);

  execute format('alter table public.%I add column if not exists deleted_at timestamptz', table_name);

  execute format('alter table public.%I add column if not exists updated_at timestamptz default now()', table_name);
  execute format('update public.%I set updated_at = now() where updated_at is null', table_name);
  execute format('alter table public.%I alter column updated_at set default now()', table_name);
  execute format('alter table public.%I alter column updated_at set not null', table_name);

  execute format('alter table public.%I add column if not exists record_version integer default 1', table_name);
  execute format('update public.%I set record_version = 1 where record_version is null', table_name);
  execute format('alter table public.%I alter column record_version set default 1', table_name);
  execute format('alter table public.%I alter column record_version set not null', table_name);

  execute format('alter table public.%I add column if not exists updated_by_device text', table_name);
  execute format('alter table public.%I add column if not exists last_batch_id text', table_name);
  execute format('alter table public.%I add column if not exists last_operation_at timestamptz', table_name);

  execute format('alter table public.%I add column if not exists conflict_marker boolean default false', table_name);
  execute format('update public.%I set conflict_marker = false where conflict_marker is null', table_name);
  execute format('alter table public.%I alter column conflict_marker set default false', table_name);
  execute format('alter table public.%I alter column conflict_marker set not null', table_name);

  select conname
  into constraint_name
  from pg_constraint
  where conrelid = format('public.%I', table_name)::regclass
    and contype = 'p'
  limit 1;

  if constraint_name is null then
    execute format('alter table public.%I add primary key (user_id, record_id)', table_name);
  elsif constraint_name <> table_name || '_pkey' then
    execute format('alter table public.%I rename constraint %I to %I', table_name, constraint_name, table_name || '_pkey');
  end if;

  execute format('alter table public.%I enable row level security', table_name);

  execute format('create index if not exists %I on public.%I (user_id)', table_name || '_user_id_idx', table_name);
  execute format('create index if not exists %I on public.%I (user_id, deleted_at)', table_name || '_user_deleted_idx', table_name);
  execute format('create index if not exists %I on public.%I (user_id, updated_at)', table_name || '_user_updated_idx', table_name);

  execute format('drop policy if exists %I on public.%I', table_name || '_owner', table_name);
  execute format(
    'create policy %I on public.%I
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)',
    table_name || '_owner',
    table_name
  );
end;
$$;

select public.ensure_entity_persistence_table('follow_up_items');
select public.ensure_entity_persistence_table('tasks');
select public.ensure_entity_persistence_table('projects');
select public.ensure_entity_persistence_table('contacts');
select public.ensure_entity_persistence_table('companies');

drop function if exists public.ensure_entity_persistence_table(text);

create table if not exists public.user_preferences (
  user_id uuid primary key,
  migration_complete boolean not null default false,
  auxiliary jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences add column if not exists user_id uuid;
alter table public.user_preferences add column if not exists migration_complete boolean default false;
alter table public.user_preferences add column if not exists auxiliary jsonb;
alter table public.user_preferences add column if not exists updated_at timestamptz default now();

update public.user_preferences set migration_complete = false where migration_complete is null;
update public.user_preferences set updated_at = now() where updated_at is null;

alter table public.user_preferences alter column user_id set not null;
alter table public.user_preferences alter column migration_complete set default false;
alter table public.user_preferences alter column migration_complete set not null;
alter table public.user_preferences alter column updated_at set default now();
alter table public.user_preferences alter column updated_at set not null;

alter table public.user_preferences enable row level security;
create index if not exists user_preferences_user_id_idx on public.user_preferences (user_id);

drop policy if exists user_preferences_owner on public.user_preferences;
create policy user_preferences_owner on public.user_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.apply_save_batch(batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id text;
  v_schema_version int;
  v_operations jsonb;
  v_operation jsonb;
  v_entity text;
  v_record_id text;
  v_operation_type text;
  v_device_id text;
  v_now timestamptz := now();
  v_table_name text;
  v_touched_tables text[] := array[]::text[];
  v_operation_count int := 0;
  v_applied_count int := 0;
  v_operation_counts jsonb := jsonb_build_object(
    'items', jsonb_build_object('upserts', 0, 'deletes', 0),
    'tasks', jsonb_build_object('upserts', 0, 'deletes', 0),
    'projects', jsonb_build_object('upserts', 0, 'deletes', 0),
    'contacts', jsonb_build_object('upserts', 0, 'deletes', 0),
    'companies', jsonb_build_object('upserts', 0, 'deletes', 0)
  );
  v_client_payload_hash text;
  v_server_payload_hash text;
  v_auxiliary jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'apply_save_batch requires an authenticated user';
  end if;

  if batch is null or jsonb_typeof(batch) <> 'object' then
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_batch', 'message', 'batch must be a JSON object');
  end if;

  v_batch_id := nullif(batch->>'batchId', '');
  v_schema_version := nullif(batch->>'schemaVersion', '')::int;
  v_operations := batch->'operations';
  v_device_id := nullif(batch->>'deviceId', '');
  v_client_payload_hash := nullif(batch->>'clientPayloadHash', '');
  v_auxiliary := batch->'auxiliary';

  if v_batch_id is null then
    return jsonb_build_object('status', 'rejected', 'reason', 'missing_batch_id', 'message', 'batchId is required');
  end if;

  if v_schema_version is null then
    return jsonb_build_object('status', 'rejected', 'reason', 'missing_schema_version', 'message', 'schemaVersion is required');
  end if;

  if v_operations is null or jsonb_typeof(v_operations) <> 'array' then
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_operations', 'message', 'operations must be an array');
  end if;

  if v_auxiliary is not null and jsonb_typeof(v_auxiliary) <> 'null' then
    insert into public.user_preferences (user_id, auxiliary, migration_complete, updated_at)
    values (v_user_id, v_auxiliary, true, v_now)
    on conflict (user_id) do update
      set auxiliary = excluded.auxiliary,
          migration_complete = true,
          updated_at = excluded.updated_at;
  end if;

  for v_operation in select value from jsonb_array_elements(v_operations)
  loop
    v_entity := nullif(v_operation->>'entity', '');
    v_record_id := nullif(v_operation->>'recordId', '');
    v_operation_type := nullif(v_operation->>'operation', '');

    if v_entity not in ('items', 'tasks', 'projects', 'contacts', 'companies') then
      return jsonb_build_object('status', 'rejected', 'reason', 'invalid_entity', 'message', format('Unsupported entity: %s', coalesce(v_entity, '<null>')));
    end if;

    if v_record_id is null then
      return jsonb_build_object('status', 'rejected', 'reason', 'missing_record_id', 'message', 'Each operation requires recordId');
    end if;

    if v_operation_type not in ('upsert', 'delete') then
      return jsonb_build_object('status', 'rejected', 'reason', 'invalid_operation', 'message', 'operation must be upsert or delete');
    end if;

    v_table_name := case v_entity
      when 'items' then 'follow_up_items'
      when 'tasks' then 'tasks'
      when 'projects' then 'projects'
      when 'contacts' then 'contacts'
      when 'companies' then 'companies'
      else null
    end;

    if v_table_name is null then
      return jsonb_build_object('status', 'rejected', 'reason', 'invalid_entity_route', 'message', 'Entity route missing');
    end if;

    v_operation_count := v_operation_count + 1;

    if v_operation_type = 'upsert' then
      execute format(
        'insert into public.%I (user_id, record_id, record, deleted_at, updated_at, record_version, updated_by_device, last_batch_id, last_operation_at, conflict_marker)
         values ($1, $2, $3, null, $4, 1, $5, $6, $4, false)
         on conflict (user_id, record_id) do update set
           record = excluded.record,
           deleted_at = null,
           updated_at = excluded.updated_at,
           record_version = coalesce(%I.record_version, 0) + 1,
           updated_by_device = excluded.updated_by_device,
           last_batch_id = excluded.last_batch_id,
           last_operation_at = excluded.last_operation_at,
           conflict_marker = false',
        v_table_name,
        v_table_name
      )
      using
        v_user_id,
        v_record_id,
        coalesce(v_operation->'recordSnapshot', jsonb_build_object('id', v_record_id)),
        v_now,
        v_device_id,
        v_batch_id;

      v_operation_counts := jsonb_set(
        v_operation_counts,
        array[v_entity, 'upserts'],
        to_jsonb(coalesce((v_operation_counts #>> array[v_entity, 'upserts'])::int, 0) + 1),
        true
      );
    else
      execute format(
        'insert into public.%I (user_id, record_id, record, deleted_at, updated_at, record_version, updated_by_device, last_batch_id, last_operation_at, conflict_marker)
         values ($1, $2, $3, coalesce($4, $5), $5, 1, $6, $7, $5, false)
         on conflict (user_id, record_id) do update set
           record = coalesce(excluded.record, %I.record),
           deleted_at = coalesce(excluded.deleted_at, excluded.updated_at),
           updated_at = excluded.updated_at,
           record_version = coalesce(%I.record_version, 0) + 1,
           updated_by_device = excluded.updated_by_device,
           last_batch_id = excluded.last_batch_id,
           last_operation_at = excluded.last_operation_at,
           conflict_marker = false',
        v_table_name,
        v_table_name,
        v_table_name
      )
      using
        v_user_id,
        v_record_id,
        coalesce(v_operation->'recordSnapshot', jsonb_build_object('id', v_record_id)),
        nullif(v_operation->>'deletedAt', '')::timestamptz,
        v_now,
        v_device_id,
        v_batch_id;

      v_operation_counts := jsonb_set(
        v_operation_counts,
        array[v_entity, 'deletes'],
        to_jsonb(coalesce((v_operation_counts #>> array[v_entity, 'deletes'])::int, 0) + 1),
        true
      );
    end if;

    v_applied_count := v_applied_count + 1;
    if not (v_table_name = any(v_touched_tables)) then
      v_touched_tables := array_append(v_touched_tables, v_table_name);
    end if;
  end loop;

  v_server_payload_hash := md5(coalesce(batch::text, ''));

  return jsonb_build_object(
    'batchId', v_batch_id,
    'userId', v_user_id::text,
    'status', 'committed',
    'committedAt', v_now,
    'schemaVersion', v_schema_version,
    'operationCount', v_operation_count,
    'appliedOperationCount', v_applied_count,
    'conflictedOperationCount', 0,
    'operationCountsByEntity', v_operation_counts,
    'touchedTables', to_jsonb(v_touched_tables),
    'clientPayloadHash', v_client_payload_hash,
    'serverPayloadHash', v_server_payload_hash,
    'hashMatch', (v_client_payload_hash is not null and v_client_payload_hash = v_server_payload_hash),
    'conflictIds', to_jsonb(array[]::text[]),
    'outboxSafeToClear', true
  );
exception
  when others then
    raise exception using
      errcode = sqlstate,
      message = format('apply_save_batch failed: %s', sqlerrm),
      detail = format('batch_id=%s user_id=%s', coalesce(v_batch_id, '<missing>'), coalesce(v_user_id::text, '<missing>'));
end;
$$;

grant execute on function public.apply_save_batch(jsonb) to authenticated;
