alter table public.campaigns
  add column if not exists external_post_id text,
  add column if not exists external_post_url text,
  add column if not exists publish_attempts integer not null default 0;
