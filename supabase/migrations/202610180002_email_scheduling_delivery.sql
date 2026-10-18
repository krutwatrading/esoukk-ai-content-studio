create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  email_hash text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','suppressed')),
  provider_email_id text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email_hash)
);

create index if not exists email_campaign_recipients_campaign_idx
  on public.email_campaign_recipients (campaign_id, status);
alter table public.email_campaign_recipients enable row level security;
revoke all on public.email_campaign_recipients from public, anon, authenticated;
grant all on public.email_campaign_recipients to service_role;
comment on table public.email_campaign_recipients is 'Hashed recipient delivery ledger used to prevent duplicate campaign sends.';
