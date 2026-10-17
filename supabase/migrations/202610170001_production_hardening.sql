create table if not exists public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

create table if not exists public.operational_checks (
  check_key text primary key,
  status text not null check (status in ('healthy', 'attention', 'failed')),
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.operational_checks enable row level security;

create or replace function public.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.api_rate_limits%rowtype;
  window_end timestamptz;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  insert into public.api_rate_limits(rate_key, request_count)
  values (p_rate_key, 0)
  on conflict (rate_key) do nothing;

  select * into current_row
  from public.api_rate_limits
  where rate_key = p_rate_key
  for update;

  window_end := current_row.window_started_at + make_interval(secs => p_window_seconds);
  if window_end <= now() then
    update public.api_rate_limits
    set window_started_at = now(), request_count = 1, updated_at = now()
    where rate_key = p_rate_key
    returning * into current_row;
    window_end := current_row.window_started_at + make_interval(secs => p_window_seconds);
  elsif current_row.request_count < p_limit then
    update public.api_rate_limits
    set request_count = request_count + 1, updated_at = now()
    where rate_key = p_rate_key
    returning * into current_row;
  else
    return jsonb_build_object('allowed', false, 'remaining', 0, 'resetAt', window_end);
  end if;

  return jsonb_build_object('allowed', true, 'remaining', greatest(0, p_limit - current_row.request_count), 'resetAt', window_end);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
revoke all on public.api_rate_limits from public, anon, authenticated;
revoke all on public.operational_checks from public, anon, authenticated;
grant all on public.api_rate_limits to service_role;
grant all on public.operational_checks to service_role;

comment on table public.operational_checks is 'Verified production controls such as backup restore drills. Never mark healthy without completing the check.';
