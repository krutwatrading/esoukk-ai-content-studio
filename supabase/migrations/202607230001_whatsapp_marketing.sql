create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_e164 text not null,
  display_name text,
  locale text not null default 'en',
  marketing_opt_in boolean not null default false,
  opt_in_source text,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,phone_e164)
);

alter table public.whatsapp_contacts enable row level security;
drop policy if exists whatsapp_contacts_select_admin on public.whatsapp_contacts;
create policy whatsapp_contacts_select_admin on public.whatsapp_contacts for select to authenticated
using(public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[]));
drop policy if exists whatsapp_contacts_write_admin on public.whatsapp_contacts;
create policy whatsapp_contacts_write_admin on public.whatsapp_contacts for all to authenticated
using(public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[]))
with check(public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[]));
grant select,insert,update,delete on public.whatsapp_contacts to authenticated;
grant select,insert,update,delete on public.whatsapp_contacts to service_role;
