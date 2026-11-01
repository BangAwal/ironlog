-- IronLog couple accounts + opt-in shared dashboard.
-- Run AFTER the original supabase/schema.sql. Existing workout tables and records are preserved.

create table if not exists public.ironlog_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Athlete',
  goal text not null default 'General fitness' check (goal in ('Chest & arms','Glutes & core','General fitness')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ironlog_couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our training team',
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ironlog_couple_members (
  couple_id uuid not null references public.ironlog_couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

alter table public.ironlog_profiles enable row level security;
alter table public.ironlog_couples enable row level security;
alter table public.ironlog_couple_members enable row level security;

drop policy if exists "Users read own IronLog profile" on public.ironlog_profiles;
create policy "Users read own IronLog profile" on public.ironlog_profiles for select using (auth.uid() = user_id);
drop policy if exists "Users create own IronLog profile" on public.ironlog_profiles;
create policy "Users create own IronLog profile" on public.ironlog_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own IronLog profile" on public.ironlog_profiles;
create policy "Users update own IronLog profile" on public.ironlog_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Members can read own couple membership" on public.ironlog_couple_members;
create policy "Members can read own couple membership" on public.ironlog_couple_members for select using (auth.uid() = user_id);
-- Couple records and membership changes are handled by the security-definer RPCs below.

create or replace function public.create_ironlog_couple(p_name text default 'Our training team')
returns table(couple_id uuid, invite_code text)
language plpgsql security definer set search_path = public
as $$
declare v_couple_id uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if exists(select 1 from public.ironlog_couple_members where user_id = auth.uid()) then
    raise exception 'You are already linked to a couple dashboard.';
  end if;
  v_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  insert into public.ironlog_couples(name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name),''),'Our training team'), v_code, auth.uid())
  returning id into v_couple_id;
  insert into public.ironlog_couple_members(couple_id,user_id) values(v_couple_id,auth.uid());
  return query select v_couple_id, v_code;
end; $$;

create or replace function public.join_ironlog_couple(p_invite_code text)
returns table(couple_id uuid, couple_name text)
language plpgsql security definer set search_path = public
as $$
declare v_couple public.ironlog_couples%rowtype; v_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if exists(select 1 from public.ironlog_couple_members where user_id = auth.uid()) then
    raise exception 'You are already linked to a couple dashboard.';
  end if;
  select * into v_couple from public.ironlog_couples where invite_code = upper(trim(p_invite_code));
  if not found then raise exception 'Invite code not found.'; end if;
  select count(*) into v_count from public.ironlog_couple_members where ironlog_couple_members.couple_id = v_couple.id;
  if v_count >= 2 then raise exception 'This couple dashboard already has two members.'; end if;
  insert into public.ironlog_couple_members(couple_id,user_id) values(v_couple.id,auth.uid());
  return query select v_couple.id, v_couple.name;
end; $$;

create or replace function public.get_my_ironlog_couple()
returns table(couple_id uuid, couple_name text, invite_code text, member_count bigint)
language sql stable security definer set search_path = public
as $$
  select c.id, c.name, c.invite_code,
         (select count(*) from public.ironlog_couple_members m2 where m2.couple_id = c.id)
  from public.ironlog_couple_members m
  join public.ironlog_couples c on c.id = m.couple_id
  where m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.get_ironlog_couple_dashboard()
returns table(member_id uuid, display_name text, goal text, workout_count bigint, total_volume numeric, last_workout_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare v_couple_id uuid;
begin
  select couple_id into v_couple_id from public.ironlog_couple_members where user_id = auth.uid();
  if v_couple_id is null then raise exception 'You are not linked to a couple dashboard.'; end if;
  return query
    select m.user_id,
      coalesce(p.display_name, 'Athlete'),
      coalesce(p.goal, 'General fitness'),
      count(distinct s.id),
      coalesce(sum(case when ws.completed then ws.weight_kg * ws.reps else 0 end),0),
      max(s.finished_at)
    from public.ironlog_couple_members m
    left join public.ironlog_profiles p on p.user_id = m.user_id
    left join public.workout_sessions s on s.user_id = m.user_id and s.finished_at is not null
    left join public.workout_sets ws on ws.session_id = s.id
    where m.couple_id = v_couple_id
    group by m.user_id, p.display_name, p.goal
    order by m.joined_at;
end; $$;

revoke all on function public.create_ironlog_couple(text) from public;
revoke all on function public.join_ironlog_couple(text) from public;
revoke all on function public.get_my_ironlog_couple() from public;
revoke all on function public.get_ironlog_couple_dashboard() from public;
grant execute on function public.create_ironlog_couple(text) to authenticated;
grant execute on function public.join_ironlog_couple(text) to authenticated;
grant execute on function public.get_my_ironlog_couple() to authenticated;
grant execute on function public.get_ironlog_couple_dashboard() to authenticated;
grant select, insert, update on public.ironlog_profiles to authenticated;
grant select on public.ironlog_couple_members to authenticated;
