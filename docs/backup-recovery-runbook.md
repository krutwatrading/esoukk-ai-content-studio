# Backup and Recovery Runbook

Use this procedure at least every 90 days and after material database changes. A backup is not considered ready until a restore has been tested.

1. In Supabase, confirm the production project's latest managed backup or point-in-time recovery status.
2. Restore that backup into a separate non-production Supabase project. Never overwrite production for a drill.
3. Confirm authentication loads and verify row counts for `organizations`, `organization_members`, `campaigns`, `campaign_variations`, `social_connections`, `shopify_contacts`, and `audit_logs` against production.
4. Confirm encrypted social tokens remain encrypted at rest. Do not attempt live publishing from the restored project.
5. Record the drill from the production Supabase SQL editor only after the checks pass:

```sql
insert into public.operational_checks(check_key,status,checked_at,metadata)
values ('backup_restore_drill','healthy',now(),jsonb_build_object('notes','Non-production restore verified'))
on conflict (check_key) do update
set status=excluded.status,checked_at=excluded.checked_at,metadata=excluded.metadata;
```

6. Delete the temporary restore project after retaining non-sensitive evidence and row-count results.

If any step fails, record `failed` instead of `healthy`, preserve the error details outside the database, and do not mark production ready until a new drill passes.
