-- IronLog schema. Run this in Supabase SQL Editor.
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id text not null,
  workout_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  set_number integer not null check (set_number > 0),
  weight_kg numeric(7,2) not null default 0,
  reps integer not null default 0 check (reps >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_started_idx on public.workout_sessions(user_id, started_at desc);
create index if not exists workout_sets_user_exercise_idx on public.workout_sets(user_id, exercise_name);
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
drop policy if exists "Users manage own workout sessions" on public.workout_sessions;
create policy "Users manage own workout sessions" on public.workout_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own workout sets" on public.workout_sets;
create policy "Users manage own workout sets" on public.workout_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
