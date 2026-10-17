import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const configured = (name: string) => Boolean(process.env[name]?.trim());

export async function GET() {
  const started = Date.now();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const { data: membership, error } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
  const admin=createSupabaseAdminClient();
  const[{error:rateLimitError},{data:backupCheck,error:operationsError},{error:monitoringError}]=await Promise.all([
    admin.from("api_rate_limits").select("rate_key",{head:true,count:"exact"}),
    admin.from("operational_checks").select("status,checked_at").eq("check_key","backup_restore_drill").maybeSingle(),
    admin.from("audit_logs").select("id",{head:true,count:"exact"}),
  ]);
  const backupFresh=Boolean(backupCheck?.status==="healthy"&&Date.now()-new Date(backupCheck.checked_at).getTime()<90*24*60*60*1000);
  const checks = {
    database: Boolean(membership?.organization_id) && !error,
    shopify: configured("SHOPIFY_CLIENT_ID") && configured("SHOPIFY_CLIENT_SECRET"),
    generativeAi: configured("OPENAI_API_KEY"),
    video: configured("RUNWAYML_API_SECRET"),
    tokenEncryption: configured("SOCIAL_TOKEN_ENCRYPTION_KEY"),
    publishingWorker: configured("CRON_SECRET"),
    rateLimiting: !rateLimitError,
    monitoring: !monitoringError,
    backupRestore: !operationsError&&backupFresh,
    legalPages: true,
  };
  const required = [checks.database, checks.shopify, checks.generativeAi, checks.video, checks.tokenEncryption,checks.rateLimiting,checks.monitoring,checks.backupRestore];
  return NextResponse.json({
    status: required.every(Boolean) ? "healthy" : "attention",
    checks,
    latencyMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
    guidance:checks.backupRestore?null:"Complete and record a backup restore drill using docs/backup-recovery-runbook.md.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
