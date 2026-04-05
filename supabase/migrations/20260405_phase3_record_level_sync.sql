-- Phase 3 save/sync trust hardening.
-- Adds explicit tombstone support so deletes are persisted as record-level operations,
-- not inferred from whole-table replacement snapshots.

alter table if exists public.follow_up_items add column if not exists deleted_at timestamptz;
alter table if exists public.tasks add column if not exists deleted_at timestamptz;
alter table if exists public.projects add column if not exists deleted_at timestamptz;
alter table if exists public.contacts add column if not exists deleted_at timestamptz;
alter table if exists public.companies add column if not exists deleted_at timestamptz;

create index if not exists follow_up_items_user_active_idx on public.follow_up_items(user_id, updated_at desc) where deleted_at is null;
create index if not exists tasks_user_active_idx on public.tasks(user_id, updated_at desc) where deleted_at is null;
create index if not exists projects_user_active_idx on public.projects(user_id, updated_at desc) where deleted_at is null;
create index if not exists contacts_user_active_idx on public.contacts(user_id, updated_at desc) where deleted_at is null;
create index if not exists companies_user_active_idx on public.companies(user_id, updated_at desc) where deleted_at is null;

comment on column public.follow_up_items.deleted_at is 'Soft-delete tombstone timestamp for explicit delete propagation.';
comment on column public.tasks.deleted_at is 'Soft-delete tombstone timestamp for explicit delete propagation.';
comment on column public.projects.deleted_at is 'Soft-delete tombstone timestamp for explicit delete propagation.';
comment on column public.contacts.deleted_at is 'Soft-delete tombstone timestamp for explicit delete propagation.';
comment on column public.companies.deleted_at is 'Soft-delete tombstone timestamp for explicit delete propagation.';
