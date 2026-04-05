-- Persistence schema hardening pass.
-- Ensures all required tables/policies exist and are aligned with app expectations.

create table if not exists public.follow_up_items (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.tasks (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.projects (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.contacts (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.companies (
  user_id uuid not null,
  record_id text not null,
  record jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key,
  migration_complete boolean not null default false,
  auxiliary jsonb,
  updated_at timestamptz not null default now()
);

-- Legacy table used during one-time migration from snapshot persistence.
create table if not exists public.app_snapshots (
  user_id uuid primary key,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

-- Backfill columns for environments created before this migration.
alter table if exists public.follow_up_items add column if not exists user_id uuid;
alter table if exists public.follow_up_items add column if not exists record_id text;
alter table if exists public.follow_up_items add column if not exists record jsonb;
alter table if exists public.follow_up_items add column if not exists updated_at timestamptz not null default now();

alter table if exists public.tasks add column if not exists user_id uuid;
alter table if exists public.tasks add column if not exists record_id text;
alter table if exists public.tasks add column if not exists record jsonb;
alter table if exists public.tasks add column if not exists updated_at timestamptz not null default now();

alter table if exists public.projects add column if not exists user_id uuid;
alter table if exists public.projects add column if not exists record_id text;
alter table if exists public.projects add column if not exists record jsonb;
alter table if exists public.projects add column if not exists updated_at timestamptz not null default now();

alter table if exists public.contacts add column if not exists user_id uuid;
alter table if exists public.contacts add column if not exists record_id text;
alter table if exists public.contacts add column if not exists record jsonb;
alter table if exists public.contacts add column if not exists updated_at timestamptz not null default now();

alter table if exists public.companies add column if not exists user_id uuid;
alter table if exists public.companies add column if not exists record_id text;
alter table if exists public.companies add column if not exists record jsonb;
alter table if exists public.companies add column if not exists updated_at timestamptz not null default now();

alter table if exists public.user_preferences add column if not exists user_id uuid;
alter table if exists public.user_preferences add column if not exists migration_complete boolean not null default false;
alter table if exists public.user_preferences add column if not exists auxiliary jsonb;
alter table if exists public.user_preferences add column if not exists updated_at timestamptz not null default now();

alter table if exists public.app_snapshots add column if not exists user_id uuid;
alter table if exists public.app_snapshots add column if not exists snapshot jsonb;
alter table if exists public.app_snapshots add column if not exists updated_at timestamptz not null default now();

create unique index if not exists follow_up_items_user_record_key on public.follow_up_items(user_id, record_id);
create unique index if not exists tasks_user_record_key on public.tasks(user_id, record_id);
create unique index if not exists projects_user_record_key on public.projects(user_id, record_id);
create unique index if not exists contacts_user_record_key on public.contacts(user_id, record_id);
create unique index if not exists companies_user_record_key on public.companies(user_id, record_id);
create unique index if not exists user_preferences_user_key on public.user_preferences(user_id);
create unique index if not exists app_snapshots_user_key on public.app_snapshots(user_id);

alter table public.follow_up_items enable row level security;
alter table public.tasks enable row level security;
alter table public.projects enable row level security;
alter table public.contacts enable row level security;
alter table public.companies enable row level security;
alter table public.user_preferences enable row level security;
alter table public.app_snapshots enable row level security;

create policy if not exists "follow_up_items owner" on public.follow_up_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "tasks owner" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "projects owner" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "contacts owner" on public.contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "companies owner" on public.companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "user_preferences owner" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "app_snapshots owner" on public.app_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.follow_up_items is 'SetPoint entity persistence table for follow-up items.';
comment on table public.tasks is 'SetPoint entity persistence table for tasks.';
comment on table public.projects is 'SetPoint entity persistence table for projects.';
comment on table public.contacts is 'SetPoint entity persistence table for contacts.';
comment on table public.companies is 'SetPoint entity persistence table for companies.';
comment on table public.user_preferences is 'SetPoint auxiliary persistence state (non-entity payload + migration flags).';
comment on table public.app_snapshots is 'Legacy snapshot table retained for one-time migration fallback.';
