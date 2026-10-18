import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await enforceRateLimit("email-approve", 20, 3600);
  if (access.response) return access.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid campaign ID." }, { status: 400, headers: access.headers });
  if (!["owner", "admin", "approver"].includes(access.role)) return NextResponse.json({ error: `Your workspace role (${access.role}) cannot approve campaigns. Ask an owner to change it to owner, admin or approver.` }, { status: 403, headers: access.headers });
  const admin = createSupabaseAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("id,status,settings").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Email campaign not found." }, { status: 404, headers: access.headers });
  if (campaign.status !== "ready_for_review") return NextResponse.json({ error: `Only campaigns awaiting review can be approved. Current status: ${campaign.status}.` }, { status: 409, headers: access.headers });
  if ((campaign.settings as { channel?: string } | null)?.channel !== "email") return NextResponse.json({ error: "This approval endpoint accepts email campaigns only." }, { status: 400, headers: access.headers });
  const { data: variation } = await admin.from("campaign_variations").select("id").eq("campaign_id", id).eq("organization_id", access.organizationId).eq("platform", "email").order("revision", { ascending: false }).limit(1).maybeSingle();
  if (!variation) return NextResponse.json({ error: "The email variation is missing." }, { status: 409, headers: access.headers });
  const { error: approvalError } = await admin.from("approvals").insert({ organization_id: access.organizationId, campaign_id: id, variation_id: variation.id, decision: "approved", comment: "Approved for scheduling from the email automation review gate.", decided_by: access.user.id });
  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500, headers: access.headers });
  const { error: updateError } = await admin.from("campaigns").update({ status: "approved" }).eq("id", id).eq("organization_id", access.organizationId).eq("status", "ready_for_review");
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500, headers: access.headers });
  await admin.from("audit_logs").insert({ organization_id: access.organizationId, actor_id: access.user.id, action: "email_campaign.approved", object_type: "campaign", object_id: id, metadata: { variation_id: variation.id } });
  return NextResponse.json({ campaignId: id, status: "approved", schedulingLocked: true }, { headers: access.headers });
}
