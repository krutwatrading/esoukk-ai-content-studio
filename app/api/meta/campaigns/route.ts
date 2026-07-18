import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  return membership ? { supabase, user, membership } : null;
}

export async function POST(request: NextRequest) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const body = await request.json(), caption = String(body.caption || "").trim(), imageUrl = String(body.imageUrl || "").trim(), product = body.product || {};
  if (!caption || !imageUrl || !product.title) return NextResponse.json({ error: "Caption, product and public image are required." }, { status: 400 });
  const { data: campaign, error: campaignError } = await ctx.supabase.from("campaigns").insert({ organization_id: ctx.membership.organization_id, name: `Instagram · ${String(product.title)}`, status: "ready_for_review", settings: { platform: "instagram", timezone: "Asia/Dubai", image_url: imageUrl }, product_snapshot: product, created_by: ctx.user.id }).select("id,status,scheduled_for").single();
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 400 });
  const { data: variation, error: variationError } = await ctx.supabase.from("campaign_variations").insert({ organization_id: ctx.membership.organization_id, campaign_id: campaign.id, platform: "instagram", variation_number: 1, content: { caption, image_url: imageUrl }, created_by: ctx.user.id }).select("id").single();
  if (variationError) return NextResponse.json({ error: variationError.message }, { status: 400 });
  return NextResponse.json({ campaign: { ...campaign, variationId: variation.id } });
}

export async function PATCH(request: NextRequest) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!["owner", "admin", "approver"].includes(ctx.membership.role)) return NextResponse.json({ error: "An owner, admin or approver must approve publishing." }, { status: 403 });
  const body = await request.json(), campaignId = String(body.campaignId || ""), variationId = String(body.variationId || "");
  if (!campaignId || !variationId) return NextResponse.json({ error: "Campaign approval information is missing." }, { status: 400 });
  if (body.action === "approve") {
    const { error } = await ctx.supabase.from("approvals").insert({ organization_id: ctx.membership.organization_id, campaign_id: campaignId, variation_id: variationId, decision: "approved", comment: "Approved for Instagram publishing", decided_by: ctx.user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const { error: updateError } = await ctx.supabase.from("campaigns").update({ status: "approved" }).eq("id", campaignId).eq("organization_id", ctx.membership.organization_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ status: "approved" });
  }
  if (body.action === "schedule") {
    const scheduledFor = new Date(String(body.scheduledFor || ""));
    if (Number.isNaN(scheduledFor.valueOf()) || scheduledFor <= new Date()) return NextResponse.json({ error: "Choose a future UAE date and time." }, { status: 400 });
    const { data: approved } = await ctx.supabase.from("approvals").select("id").eq("campaign_id", campaignId).eq("variation_id", variationId).eq("decision", "approved").limit(1).maybeSingle();
    if (!approved) return NextResponse.json({ error: "Approve this Instagram draft before scheduling it." }, { status: 409 });
    const { error } = await ctx.supabase.from("campaigns").update({ status: "scheduled", scheduled_for: scheduledFor.toISOString(), publishing_error: null }).eq("id", campaignId).eq("organization_id", ctx.membership.organization_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ status: "scheduled", scheduledFor: scheduledFor.toISOString() });
  }
  return NextResponse.json({ error: "Unsupported publishing action." }, { status: 400 });
}
