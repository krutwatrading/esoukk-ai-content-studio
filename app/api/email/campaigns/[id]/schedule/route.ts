import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await enforceRateLimit("email-schedule", 20, 3600);
  if (access.response) return access.response;
  const { id } = await context.params, input = await request.json().catch(() => ({})) as { scheduledFor?: unknown; consentConfirmed?: unknown };
  const scheduledFor = new Date(String(input.scheduledFor || ""));
  if (!input.consentConfirmed) return NextResponse.json({ error: "Confirm that delivery is restricted to currently subscribed, non-suppressed contacts." }, { status: 400, headers: access.headers });
  if (Number.isNaN(scheduledFor.valueOf()) || scheduledFor <= new Date(Date.now() + 60_000)) return NextResponse.json({ error: "Choose a time at least one minute in the future." }, { status: 400, headers: access.headers });
  if (!["owner", "admin", "approver"].includes(access.role)) return NextResponse.json({ error: `Your workspace role (${access.role}) cannot schedule campaigns. Ask an owner to change it to owner, admin or approver.` }, { status: 403, headers: access.headers });
  const admin = createSupabaseAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("id,status,settings").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (!campaign || campaign.status !== "approved" || (campaign.settings as { channel?: string } | null)?.channel !== "email") return NextResponse.json({ error: "Only an approved email campaign can be scheduled." }, { status: 409, headers: access.headers });
  const { error } = await admin.from("campaigns").update({ status: "scheduled", scheduled_for: scheduledFor.toISOString(), publishing_error: null }).eq("id", id).eq("organization_id", access.organizationId).eq("status", "approved");
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: access.headers });
  await admin.from("audit_logs").insert({ organization_id: access.organizationId, actor_id: access.user.id, action: "email_campaign.scheduled", object_type: "campaign", object_id: id, metadata: { scheduled_for: scheduledFor.toISOString(), consent_recheck_required: true } });
  return NextResponse.json({ campaignId: id, status: "scheduled", scheduledFor: scheduledFor.toISOString(), deliveryEnabled: process.env.EMAIL_BULK_SEND_ENABLED === "true" }, { headers: access.headers });
}
