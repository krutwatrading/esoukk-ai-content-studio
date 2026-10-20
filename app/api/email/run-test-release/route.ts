import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = await enforceRateLimit("email-test-release", 30, 3600);
  if (access.response) return access.response;
  if (!["owner", "admin", "approver"].includes(access.role)) return NextResponse.json({ error: "Owner, admin or approver access is required." }, { status: 403, headers: access.headers });
  if (process.env.EMAIL_LIVE_AUDIENCE_MODE !== "test") return NextResponse.json({ error: "Controlled release requires EMAIL_LIVE_AUDIENCE_MODE=test." }, { status: 423, headers: access.headers });
  if (process.env.EMAIL_BULK_SEND_ENABLED !== "true") return NextResponse.json({ error: "Controlled test delivery is locked. Set EMAIL_BULK_SEND_ENABLED=true in Production and redeploy." }, { status: 423, headers: access.headers });
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503, headers: access.headers });
  const input = await request.json().catch(() => ({})) as { campaignId?: unknown };
  const campaignId = String(input.campaignId || "");
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return NextResponse.json({ error: "A valid scheduled campaign is required." }, { status: 400, headers: access.headers });
  const admin = createSupabaseAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("id,status,settings").eq("id", campaignId).eq("organization_id", access.organizationId).maybeSingle();
  if (!campaign || campaign.status !== "scheduled" || (campaign.settings as { channel?: string } | null)?.channel !== "email") return NextResponse.json({ error: "Only your scheduled email campaign can be released as a test." }, { status: 409, headers: access.headers });
  const { error: releaseError } = await admin.from("campaigns").update({ scheduled_for: new Date(Date.now() - 1000).toISOString() }).eq("id", campaignId).eq("organization_id", access.organizationId).eq("status", "scheduled");
  if (releaseError) return NextResponse.json({ error: releaseError.message }, { status: 500, headers: access.headers });
  const workerUrl = new URL("/api/email/send-due", process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);
  workerUrl.searchParams.set("campaignId", campaignId);
  const response = await fetch(workerUrl, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status, headers: access.headers });
}
