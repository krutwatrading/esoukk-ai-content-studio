alter table public.whatsapp_contacts
  add column if not exists country text,
  add column if not exists country_code text;

notify pgrst, 'reload schema';
