create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null, provider_account_id text not null, account_name text, encrypted_access_token text not null,
  token_expires_at timestamptz, scopes jsonb not null default '[]'::jsonb, status text not null default 'active',
  connected_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,provider,provider_account_id)
);
alter table public.social_connections enable row level security;
create policy social_connections_select_admin on public.social_connections for select to authenticated using(public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy social_connections_write_admin on public.social_connections for all to authenticated using(public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[])) with check(public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[]));
grant select,insert,update,delete on public.social_connections to authenticated;
