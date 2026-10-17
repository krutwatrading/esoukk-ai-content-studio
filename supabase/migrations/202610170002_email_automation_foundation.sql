create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_hash text not null,
  reason text not null default 'unsubscribe',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (organization_id,email_hash)
);
create index if not exists email_suppressions_organization_idx on public.email_suppressions(organization_id,created_at desc);
alter table public.email_suppressions enable row level security;
revoke all on public.email_suppressions from public,anon,authenticated;
grant all on public.email_suppressions to service_role;
comment on table public.email_suppressions is 'Hashed email opt-outs. Eligible audiences must exclude every matching hash before delivery.';
