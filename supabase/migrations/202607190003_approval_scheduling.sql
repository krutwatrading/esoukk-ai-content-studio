alter table public.campaigns
  add column if not exists scheduled_for timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists publishing_error text;

create index if not exists campaigns_scheduled_for_idx
  on public.campaigns(scheduled_for)
  where status = 'scheduled';
