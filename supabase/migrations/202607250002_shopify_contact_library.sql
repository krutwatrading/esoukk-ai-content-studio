alter table public.whatsapp_contacts
  alter column phone_e164 drop not null,
  add column if not exists email text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists shopify_customer_id text,
  add column if not exists customer_state text,
  add column if not exists email_marketing_state text,
  add column if not exists sms_marketing_state text,
  add column if not exists shopify_tags text[] not null default '{}',
  add column if not exists shopify_updated_at timestamptz,
  add column if not exists synced_at timestamptz;

create unique index if not exists whatsapp_contacts_shopify_customer_idx
  on public.whatsapp_contacts (organization_id, shopify_customer_id);

create index if not exists whatsapp_contacts_email_idx
  on public.whatsapp_contacts (organization_id, lower(email))
  where email is not null;

alter table public.whatsapp_contacts
  drop constraint if exists whatsapp_contacts_phone_or_email_check;

alter table public.whatsapp_contacts
  add constraint whatsapp_contacts_phone_or_email_check
  check (phone_e164 is not null or email is not null);

notify pgrst, 'reload schema';
