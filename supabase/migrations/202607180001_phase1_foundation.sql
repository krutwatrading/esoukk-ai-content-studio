begin;

create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'creator', 'approver', 'viewer');
create type public.campaign_status as enum ('draft', 'generating', 'generation_failed', 'ready_for_review', 'changes_requested', 'approved', 'scheduled', 'publishing', 'published', 'partially_failed', 'completed', 'archived');
create type public.approval_decision as enum ('approved', 'changes_requested', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Asia/Dubai',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  store_name text not null,
  website_url text,
  voice jsonb not null default '[]'::jsonb,
  audiences jsonb not null default '[]'::jsonb,
  colors jsonb not null default '{}'::jsonb,
  typography jsonb not null default '{}'::jsonb,
  approved_ctas jsonb not null default '[]'::jsonb,
  prohibited_claims jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shopify_product_id text,
  handle text not null,
  url text not null,
  title text not null,
  status text,
  snapshot jsonb not null,
  shopify_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, handle)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  status public.campaign_status not null default 'draft',
  settings jsonb not null default '{}'::jsonb,
  product_snapshot jsonb not null default '{}'::jsonb,
  prompt_version text,
  model text,
  estimated_cost numeric(12,4) not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_variations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  platform text not null,
  variation_number integer not null check (variation_number > 0),
  revision integer not null default 1 check (revision > 0),
  content jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (campaign_id, platform, variation_number, revision)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  variation_id uuid references public.campaign_variations(id) on delete set null,
  platform text not null,
  format text not null,
  storage_path text,
  preview_path text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  mime_type text,
  generation_status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  variation_id uuid references public.campaign_variations(id) on delete cascade,
  decision public.approval_decision not null,
  comment text,
  decided_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (asset_id is not null or variation_id is not null)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  object_type text not null,
  object_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id);
create index products_organization_idx on public.products(organization_id);
create index campaigns_organization_status_idx on public.campaigns(organization_id, status);
create index campaign_variations_campaign_idx on public.campaign_variations(campaign_id);
create index assets_campaign_idx on public.assets(campaign_id);
create index approvals_campaign_idx on public.approvals(campaign_id);
create index audit_logs_organization_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger brand_profiles_set_updated_at before update on public.brand_profiles for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.create_organization(organization_name text, organization_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name, slug, created_by)
  values (organization_name, organization_slug, auth.uid())
  returning id into new_organization_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');
  return new_organization_id;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.products enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_variations enable row level security;
alter table public.assets enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_select_member on public.organizations for select to authenticated using (public.is_organization_member(id));
create policy organizations_update_admin on public.organizations for update to authenticated
  using (public.has_organization_role(id, array['owner','admin']::public.organization_role[]))
  with check (public.has_organization_role(id, array['owner','admin']::public.organization_role[]));

create policy organization_members_select_member on public.organization_members for select to authenticated using (public.is_organization_member(organization_id));
create policy organization_members_insert_owner on public.organization_members for insert to authenticated
  with check (public.has_organization_role(organization_id, array['owner']::public.organization_role[]));
create policy organization_members_update_owner on public.organization_members for update to authenticated
  using (public.has_organization_role(organization_id, array['owner']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner']::public.organization_role[]));
create policy organization_members_delete_owner on public.organization_members for delete to authenticated
  using (public.has_organization_role(organization_id, array['owner']::public.organization_role[]) and user_id <> auth.uid());

create policy brand_profiles_select_member on public.brand_profiles for select to authenticated using (public.is_organization_member(organization_id));
create policy brand_profiles_write_admin on public.brand_profiles for all to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy products_select_member on public.products for select to authenticated using (public.is_organization_member(organization_id));
create policy products_write_creator on public.products for all to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]));

create policy campaigns_select_member on public.campaigns for select to authenticated using (public.is_organization_member(organization_id));
create policy campaigns_write_creator on public.campaigns for all to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]));

create policy variations_select_member on public.campaign_variations for select to authenticated using (public.is_organization_member(organization_id));
create policy variations_write_creator on public.campaign_variations for all to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]));

create policy assets_select_member on public.assets for select to authenticated using (public.is_organization_member(organization_id));
create policy assets_write_creator on public.assets for all to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin','creator']::public.organization_role[]));

create policy approvals_select_member on public.approvals for select to authenticated using (public.is_organization_member(organization_id));
create policy approvals_insert_approver on public.approvals for insert to authenticated
  with check (
    decided_by = (select auth.uid()) and
    public.has_organization_role(organization_id, array['owner','admin','approver']::public.organization_role[])
  );

create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.organizations, public.organization_members,
  public.brand_profiles, public.products, public.campaigns, public.campaign_variations, public.assets, public.approvals to authenticated;
grant select on public.audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
