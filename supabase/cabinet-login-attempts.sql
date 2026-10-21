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

-- Remove all access from anon and authenticated roles.
-- PUBLIC is revoked as well: PUBLIC is an implicit parent of every role,
-- so revoking only from anon/authenticated would leave the table reachable.
revoke all on table public.cabinet_login_attempts from public;
revoke all on table public.cabinet_login_attempts from anon;
revoke all on table public.cabinet_login_attempts from authenticated;

-- Ensure only service_role can access (service_role bypasses RLS by default)
-- Grant explicit access to service_role if needed
grant all on table public.cabinet_login_attempts to service_role;

-- Atomic rate limit check and increment function
-- Returns: (allowed boolean, remaining integer, locked boolean)
--
-- Concurrency contract:
--   * the counter row is created and updated inside a single upsert that takes
--     a row lock, so parallel first attempts are serialized instead of being
--     silently dropped by "on conflict do nothing";
--   * the counter is only incremented after the row lock is held, so the
--     value in the table always equals the number of observed attempts;
--   * the row lock is held until the transaction ends, so a parallel request
--     cannot read a stale counter.
create or replace function public.check_cabinet_login_rate_limit(p_client_key text)
returns table (allowed boolean, remaining integer, locked boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - interval '15 minutes';
  v_lock_until timestamptz := v_now + interval '15 minutes';
  v_max_attempts integer := 10;
  v_count integer;
  v_locked_until timestamptz;
begin
  if p_client_key is null or btrim(p_client_key) = '' then
    return query select false, 0, true;
    return;
  end if;

  -- Single atomic upsert: creates the row or takes a row lock on the
  -- existing one. "do update" (not "do nothing") is required so that a
  -- concurrent first attempt is counted instead of being lost.
  insert into public.cabinet_login_attempts as t
    (client_key, attempt_count, first_attempt_at, last_attempt_at, locked_until)
  values (p_client_key, 1, v_now, v_now, null)
  on conflict (client_key) do update
    set attempt_count = case
          when t.locked_until is not null and t.locked_until > v_now then t.attempt_count
          when t.first_attempt_at < v_window_start then 1
          else t.attempt_count + 1
        end,
        first_attempt_at = case
          when t.locked_until is not null and t.locked_until > v_now then t.first_attempt_at
          when t.first_attempt_at < v_window_start then v_now
          else t.first_attempt_at
        end,
        last_attempt_at = v_now,
        locked_until = case
          when t.locked_until is not null and t.locked_until > v_now then t.locked_until
          else null
        end
  returning t.attempt_count, t.locked_until into v_count, v_locked_until;

  -- Still inside the lock window: the key is blocked.
  if v_locked_until is not null and v_locked_until > v_now then
    return query select false, 0, true;
    return;
  end if;

  -- Limit reached: block and remember the lock. The row is already locked by
  -- the upsert above, so this update cannot race with a parallel request.
  if v_count >= v_max_attempts then
    update public.cabinet_login_attempts
    set locked_until = v_lock_until
    where client_key = p_client_key;

    return query select false, 0, true;
    return;
  end if;

  return query select true, v_max_attempts - v_count, false;
  return;
end;
$$;

-- Reset function on successful login
create or replace function public.reset_cabinet_login_rate_limit(p_client_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_client_key is null or btrim(p_client_key) = '' then
    return;
  end if;

  delete from public.cabinet_login_attempts
  where client_key = p_client_key;
end;
$$;

-- Revoke access from PUBLIC, anon and authenticated.
-- Without "from public" the default PUBLIC execute grant stays in place and
-- anon/authenticated could call the RPCs directly and clear their own lock.
revoke all on function public.check_cabinet_login_rate_limit(text) from public;
revoke all on function public.check_cabinet_login_rate_limit(text) from anon;
revoke all on function public.check_cabinet_login_rate_limit(text) from authenticated;
revoke all on function public.reset_cabinet_login_rate_limit(text) from public;
revoke all on function public.reset_cabinet_login_rate_limit(text) from anon;
revoke all on function public.reset_cabinet_login_rate_limit(text) from authenticated;

grant execute on function public.check_cabinet_login_rate_limit(text) to service_role;
grant execute on function public.reset_cabinet_login_rate_limit(text) to service_role;
