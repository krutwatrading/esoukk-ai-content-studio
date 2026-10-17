create table if not exists public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_email_id text,
  event_type text not null,
  recipient_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists email_delivery_events_organization_idx on public.email_delivery_events(organization_id,created_at desc);
create index if not exists email_delivery_events_provider_email_idx on public.email_delivery_events(provider_email_id);
alter table public.email_delivery_events enable row level security;
revoke all on public.email_delivery_events from public,anon,authenticated;
grant all on public.email_delivery_events to service_role;
comment on table public.email_delivery_events is 'Signed Resend webhook events. Recipient addresses are stored only as SHA-256 hashes.';
