-- Entity persistence replaces snapshot-wide writes with normalized per-entity records.

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

alter table public.follow_up_items enable row level security;
alter table public.tasks enable row level security;
alter table public.projects enable row level security;
alter table public.contacts enable row level security;
alter table public.companies enable row level security;
alter table public.user_preferences enable row level security;

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
