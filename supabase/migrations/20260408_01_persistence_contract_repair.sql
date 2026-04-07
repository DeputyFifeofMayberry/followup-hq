-- Persistence contract repair / hardening migration.
-- Ensures cloud persistence tables and policies match the client save contract.

create table if not exists public.follow_up_items (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.tasks (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.projects (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.contacts (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.companies (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key,
  migration_complete boolean not null default false,
  auxiliary jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_snapshots (
  user_id uuid primary key,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
  entity_tables text[] := array['follow_up_items', 'tasks', 'projects', 'contacts', 'companies'];
begin
  foreach t in array entity_tables loop
    execute format('alter table if exists public.%I add column if not exists user_id uuid', t);
    execute format('alter table if exists public.%I add column if not exists record_id text', t);
    execute format('alter table if exists public.%I add column if not exists record jsonb', t);
    execute format('alter table if exists public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table if exists public.%I add column if not exists updated_at timestamptz', t);
    execute format('alter table if exists public.%I add column if not exists record_version integer', t);
    execute format('alter table if exists public.%I add column if not exists updated_by_device text', t);
    execute format('alter table if exists public.%I add column if not exists last_batch_id text', t);
    execute format('alter table if exists public.%I add column if not exists last_operation_at timestamptz', t);
    execute format('alter table if exists public.%I add column if not exists conflict_marker boolean', t);

    execute format('update public.%I set updated_at = now() where updated_at is null', t);
    execute format('update public.%I set record_version = 1 where record_version is null', t);
    execute format('update public.%I set conflict_marker = false where conflict_marker is null', t);

    execute format('alter table public.%I alter column updated_at set default now()', t);
    execute format('alter table public.%I alter column updated_at set not null', t);
    execute format('alter table public.%I alter column record_version set default 1', t);
    execute format('alter table public.%I alter column record_version set not null', t);
    execute format('alter table public.%I alter column conflict_marker set default false', t);
    execute format('alter table public.%I alter column conflict_marker set not null', t);

    execute format('create unique index if not exists %I on public.%I (user_id, record_id)', t || '_user_record_key', t);
    execute format('create index if not exists %I on public.%I (user_id, deleted_at)', t || '_user_deleted_at_idx', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s owner" on public.%I', t, t);
    execute format('create policy "%s owner" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

alter table public.user_preferences enable row level security;
drop policy if exists "user_preferences owner" on public.user_preferences;
create policy "user_preferences owner" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.app_snapshots enable row level security;
drop policy if exists "app_snapshots owner" on public.app_snapshots;
create policy "app_snapshots owner" on public.app_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
