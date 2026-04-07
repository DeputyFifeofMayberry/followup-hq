-- Drift repair migration for already-deployed projects.
-- This migration force-reconciles persistence contract tables/functions where prior migrations were missed or partially applied.

create table if not exists public.persistence_contract_meta (
  contract_name text primary key,
  contract_version text not null,
  migration_signature text not null,
  updated_at timestamptz not null default now()
);

insert into public.persistence_contract_meta (contract_name, contract_version, migration_signature, updated_at)
values ('entity_persistence_v2', '2026-04-07.2', '20260407_backend_contract_drift_repair', now())
on conflict (contract_name) do update
  set contract_version = excluded.contract_version,
      migration_signature = excluded.migration_signature,
      updated_at = excluded.updated_at;

create or replace function public.ensure_entity_persistence_contract(table_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_pk text;
begin
  execute format('create table if not exists public.%I (user_id uuid not null, record_id text not null, record jsonb not null, deleted_at timestamptz null, updated_at timestamptz not null default now(), record_version integer not null default 1, updated_by_device text null, last_batch_id text null, last_operation_at timestamptz null, conflict_marker boolean not null default false, primary key (user_id, record_id))', table_name);

  execute format('alter table public.%I add column if not exists user_id uuid', table_name);
  execute format('alter table public.%I add column if not exists record_id text', table_name);
  execute format('alter table public.%I add column if not exists record jsonb', table_name);
  execute format('alter table public.%I add column if not exists deleted_at timestamptz', table_name);
  execute format('alter table public.%I add column if not exists updated_at timestamptz', table_name);
  execute format('alter table public.%I add column if not exists record_version integer', table_name);
  execute format('alter table public.%I add column if not exists updated_by_device text', table_name);
  execute format('alter table public.%I add column if not exists last_batch_id text', table_name);
  execute format('alter table public.%I add column if not exists last_operation_at timestamptz', table_name);
  execute format('alter table public.%I add column if not exists conflict_marker boolean', table_name);

  execute format('update public.%I set record = jsonb_build_object(''id'', record_id) where record is null', table_name);
  execute format('update public.%I set updated_at = now() where updated_at is null', table_name);
  execute format('update public.%I set record_version = 1 where record_version is null', table_name);
  execute format('update public.%I set conflict_marker = false where conflict_marker is null', table_name);

  execute format('alter table public.%I alter column user_id set not null', table_name);
  execute format('alter table public.%I alter column record_id set not null', table_name);
  execute format('alter table public.%I alter column record set not null', table_name);
  execute format('alter table public.%I alter column updated_at set default now()', table_name);
  execute format('alter table public.%I alter column updated_at set not null', table_name);
  execute format('alter table public.%I alter column record_version set default 1', table_name);
  execute format('alter table public.%I alter column record_version set not null', table_name);
  execute format('alter table public.%I alter column conflict_marker set default false', table_name);
  execute format('alter table public.%I alter column conflict_marker set not null', table_name);

  select conname
  into existing_pk
  from pg_constraint
  where conrelid = format('public.%I', table_name)::regclass
    and contype = 'p'
  limit 1;

  if existing_pk is null then
    execute format('alter table public.%I add primary key (user_id, record_id)', table_name);
  end if;

  execute format('alter table public.%I enable row level security', table_name);
  execute format('drop policy if exists %I on public.%I', table_name || '_owner', table_name);
  execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name || '_owner', table_name);
end;
$$;

select public.ensure_entity_persistence_contract('follow_up_items');
select public.ensure_entity_persistence_contract('tasks');
select public.ensure_entity_persistence_contract('projects');
select public.ensure_entity_persistence_contract('contacts');
select public.ensure_entity_persistence_contract('companies');

drop function if exists public.ensure_entity_persistence_contract(text);

create table if not exists public.user_preferences (
  user_id uuid primary key,
  migration_complete boolean not null default false,
  auxiliary jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences add column if not exists user_id uuid;
alter table public.user_preferences add column if not exists migration_complete boolean;
alter table public.user_preferences add column if not exists auxiliary jsonb;
alter table public.user_preferences add column if not exists updated_at timestamptz;

update public.user_preferences set migration_complete = false where migration_complete is null;
update public.user_preferences set updated_at = now() where updated_at is null;

alter table public.user_preferences alter column user_id set not null;
alter table public.user_preferences alter column migration_complete set default false;
alter table public.user_preferences alter column migration_complete set not null;
alter table public.user_preferences alter column updated_at set default now();
alter table public.user_preferences alter column updated_at set not null;

alter table public.user_preferences enable row level security;
drop policy if exists user_preferences_owner on public.user_preferences;
create policy user_preferences_owner on public.user_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_persistence_contract_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  required_tables text[] := array['follow_up_items','tasks','projects','contacts','companies'];
  required_columns text[] := array['user_id','record_id','record','deleted_at','updated_at','record_version','updated_by_device','last_batch_id','last_operation_at','conflict_marker'];
  tbl text;
  col text;
  contract_version text := 'unknown';
  migration_signature_present boolean := false;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'persistence_contract_meta') then
    select pcm.contract_version, (pcm.migration_signature = '20260407_backend_contract_drift_repair')
    into contract_version, migration_signature_present
    from public.persistence_contract_meta pcm
    where pcm.contract_name = 'entity_persistence_v2'
    limit 1;
  end if;

  foreach tbl in array required_tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      return jsonb_build_object(
        'status', 'missing_table',
        'failingTable', tbl,
        'details', format('Required table public.%s is missing.', tbl),
        'backendContractVersion', contract_version,
        'migrationSignaturePresent', migration_signature_present
      );
    end if;

    foreach col in array required_columns loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = tbl and column_name = col
      ) then
        return jsonb_build_object(
          'status', 'missing_column',
          'failingTable', tbl,
          'failingColumn', col,
          'details', format('Required column public.%s.%s is missing.', tbl, col),
          'backendContractVersion', contract_version,
          'migrationSignaturePresent', migration_signature_present
        );
      end if;
    end loop;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_preferences' and column_name in ('user_id','migration_complete','auxiliary','updated_at')
    group by table_name
    having count(*) = 4
  ) then
    return jsonb_build_object(
      'status', 'missing_column',
      'failingTable', 'user_preferences',
      'details', 'user_preferences table is missing one or more required columns.',
      'backendContractVersion', contract_version,
      'migrationSignaturePresent', migration_signature_present
    );
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_save_batch'
      and pg_get_function_identity_arguments(p.oid) = 'batch jsonb'
  ) then
    return jsonb_build_object(
      'status', 'missing_rpc',
      'failingRpc', 'apply_save_batch',
      'details', 'Required RPC public.apply_save_batch(batch jsonb) is missing.',
      'backendContractVersion', contract_version,
      'migrationSignaturePresent', migration_signature_present
    );
  end if;

  return jsonb_build_object(
    'status', 'healthy',
    'backendContractVersion', contract_version,
    'migrationSignaturePresent', migration_signature_present,
    'details', 'Persistence contract verified.'
  );
end;
$$;
