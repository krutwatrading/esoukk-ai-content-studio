create table if not exists public.campaign_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider text not null default 'instagram',
  external_post_id text not null,
  views bigint not null default 0,
  reach bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  saves bigint not null default 0,
  shares bigint not null default 0,
  total_interactions bigint not null default 0,
  engagement_rate numeric(8,4) not null default 0,
  captured_at timestamptz not null default now(),
  unique (campaign_id, captured_at)
);

create index if not exists campaign_metric_snapshots_campaign_idx
  on public.campaign_metric_snapshots(campaign_id, captured_at desc);

alter table public.campaign_metric_snapshots enable row level security;

drop policy if exists campaign_metric_snapshots_select_member on public.campaign_metric_snapshots;
create policy campaign_metric_snapshots_select_member
  on public.campaign_metric_snapshots for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists campaign_metric_snapshots_write_admin on public.campaign_metric_snapshots;
create policy campaign_metric_snapshots_write_admin
  on public.campaign_metric_snapshots for all to authenticated
  using (public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[]))
  with check (public.has_organization_role(organization_id,array['owner','admin']::public.organization_role[]));

grant select on public.campaign_metric_snapshots to authenticated;
grant select,insert,update,delete on public.campaign_metric_snapshots to service_role;
