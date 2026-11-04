-- IronLog flexible workout scheduling
-- Run once in Supabase SQL Editor. Does not alter workout history or program definitions.

create table if not exists public.workout_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_date date not null,
  original_date date not null,
  program_id text null,
  status text not null check (status in ('postponed', 'rescheduled', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_schedule_overrides_user_date_key unique (user_id, schedule_date)
);

create index if not exists workout_schedule_overrides_user_date_idx
  on public.workout_schedule_overrides (user_id, schedule_date);

alter table public.workout_schedule_overrides enable row level security;

drop policy if exists "Users manage own workout schedule overrides"
  on public.workout_schedule_overrides;
create policy "Users manage own workout schedule overrides"
  on public.workout_schedule_overrides
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_workout_schedule_override_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workout_schedule_overrides_updated_at
  on public.workout_schedule_overrides;
create trigger workout_schedule_overrides_updated_at
before update on public.workout_schedule_overrides
for each row execute function public.set_workout_schedule_override_updated_at();
