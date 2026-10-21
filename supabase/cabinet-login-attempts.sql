-- Cabinet login rate limit table
-- Apply with service_role only. Do NOT apply to production without approval.
-- Table must be inaccessible to anon/authenticated clients.

create table if not exists public.cabinet_login_attempts (
  client_key text primary key,
  attempt_count integer not null default 1,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  locked_until timestamptz
);

create index if not exists cabinet_login_attempts_locked_until_idx
  on public.cabinet_login_attempts (locked_until);

alter table public.cabinet_login_attempts enable row level security;

-- Remove all access from anon and authenticated roles
revoke all on table public.cabinet_login_attempts from anon;
revoke all on table public.cabinet_login_attempts from authenticated;

-- Ensure only service_role can access (service_role bypasses RLS by default)
-- Grant explicit access to service_role if needed
grant all on table public.cabinet_login_attempts to service_role;

-- Atomic rate limit check and increment function
-- Returns: (allowed boolean, remaining integer, locked boolean)
create or replace function public.check_cabinet_login_rate_limit(p_client_key text)
returns table (allowed boolean, remaining integer, locked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cabinet_login_attempts%rowtype;
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - interval '15 minutes';
  v_lock_until timestamptz := v_now + interval '15 minutes';
  v_max_attempts integer := 10;
  v_new_count integer;
  v_window_expired boolean;
begin
  -- Lock the row for update to prevent race conditions
  select * into v_row
  from public.cabinet_login_attempts
  where client_key = p_client_key
  for update;

  if not found then
    -- First attempt
    insert into public.cabinet_login_attempts (client_key, attempt_count, first_attempt_at, last_attempt_at, locked_until)
    values (p_client_key, 1, v_now, v_now, null)
    on conflict (client_key) do nothing;
    
    return query select true, v_max_attempts - 1, false;
  end if;

  -- Check if currently locked
  if v_row.locked_until is not null and v_row.locked_until > v_now then
    return query select false, 0, true;
  end if;

  -- Check if window expired
  v_window_expired := v_row.first_attempt_at < v_window_start;
  
  if v_window_expired then
    v_new_count := 1;
  else
    v_new_count := v_row.attempt_count + 1;
  end if;

  if v_new_count >= v_max_attempts then
    -- Lock the account
    update public.cabinet_login_attempts
    set attempt_count = v_new_count,
        first_attempt_at = case when v_window_expired then v_now else v_row.first_attempt_at end,
        last_attempt_at = v_now,
        locked_until = v_lock_until
    where client_key = p_client_key;
    
    return query select false, 0, true;
  else
    update public.cabinet_login_attempts
    set attempt_count = v_new_count,
        first_attempt_at = case when v_window_expired then v_now else v_row.first_attempt_at end,
        last_attempt_at = v_now,
        locked_until = null
    where client_key = p_client_key;
    
    return query select true, v_max_attempts - v_new_count, false;
  end if;
end;
$$;

-- Reset function on successful login
create or replace function public.reset_cabinet_login_rate_limit(p_client_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cabinet_login_attempts where client_key = p_client_key;
end;
$$;

-- Revoke access from anon/authenticated
revoke all on function public.check_cabinet_login_rate_limit(text) from anon, authenticated;
revoke all on function public.reset_cabinet_login_rate_limit(text) from anon, authenticated;
grant execute on function public.check_cabinet_login_rate_limit(text) to service_role;
grant execute on function public.reset_cabinet_login_rate_limit(text) to service_role;
