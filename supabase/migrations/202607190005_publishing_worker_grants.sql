grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.campaigns,
  public.campaign_variations,
  public.approvals,
  public.social_connections,
  public.audit_logs
to service_role;

grant usage, select on all sequences in schema public to service_role;
