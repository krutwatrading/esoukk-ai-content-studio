import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  return membership ? { supabase, user, membership } : null;
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { data: campaigns, error } = await ctx.supabase.from("campaigns").select("id,name,status,settings,product_snapshot,scheduled_for,published_at,publishing_error,external_post_url,publish_attempts,created_at").eq("organization_id",ctx.membership.organization_id).order("created_at",{ascending:false}).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids=(campaigns||[]).map(item=>item.id);
  if(!ids.length)return NextResponse.json({campaigns:[]});
  const { data: variations } = await ctx.supabase.from("campaign_variations").select("id,campaign_id,platform,content").in("campaign_id",ids).order("created_at",{ascending:false});
  const variationByCampaign=new Map<string,{id:string;platform:string;content:Record<string,unknown>}>();
  for(const variation of variations||[])if(!variationByCampaign.has(variation.campaign_id))variationByCampaign.set(variation.campaign_id,variation);
  return NextResponse.json({campaigns:(campaigns||[]).map(item=>({...item,variation:variationByCampaign.get(item.id)||null}))});
}

export async function POST(request: NextRequest) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const body = await request.json(), platform = body.platform === "whatsapp" ? "whatsapp" : "instagram", imageUrl = String(body.imageUrl || "").trim(), product = body.product || {};
  const caption = String(body.caption || "").trim(), templateName = String(body.templateName || "").trim(), templateLanguage = String(body.templateLanguage || "en").trim(), messageBody = String(body.body || "").trim();
  if (!imageUrl || !product.title) return NextResponse.json({ error: "Product and public image are required." }, { status: 400 });
  if (platform === "instagram" && !caption) return NextResponse.json({ error: "Instagram caption is required." }, { status: 400 });
  if (platform === "whatsapp" && (!templateName || !messageBody)) return NextResponse.json({ error: "Approved WhatsApp template name and message preview are required." }, { status: 400 });
  const label = platform === "whatsapp" ? "WhatsApp" : "Instagram";
  const { data: campaign, error: campaignError } = await ctx.supabase.from("campaigns").insert({ organization_id: ctx.membership.organization_id, name: `${label} · ${String(product.title)}`, status: "ready_for_review", settings: { platform, timezone: "Asia/Dubai", image_url: imageUrl }, product_snapshot: product, created_by: ctx.user.id }).select("id,status,scheduled_for").single();
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 400 });
  const content = platform === "whatsapp"
    ? { template_name: templateName, template_language: templateLanguage, body: messageBody, image_url: imageUrl, cta: String(body.cta || "SHOP NOW"), cta_label: String(body.cta || "SHOP NOW"), product_url: String(body.productUrl || product.url || "") }
    : { caption, image_url: imageUrl };
  const { data: variation, error: variationError } = await ctx.supabase.from("campaign_variations").insert({ organization_id: ctx.membership.organization_id, campaign_id: campaign.id, platform, variation_number: 1, content, created_by: ctx.user.id }).select("id").single();
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
    const { error } = await ctx.supabase.from("approvals").insert({ organization_id: ctx.membership.organization_id, campaign_id: campaignId, variation_id: variationId, decision: "approved", comment: "Approved for publishing", decided_by: ctx.user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const { error: updateError } = await ctx.supabase.from("campaigns").update({ status: "approved" }).eq("id", campaignId).eq("organization_id", ctx.membership.organization_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ status: "approved" });
  }
  if (body.action === "schedule") {
    const scheduledFor = new Date(String(body.scheduledFor || ""));
    if (Number.isNaN(scheduledFor.valueOf()) || scheduledFor <= new Date()) return NextResponse.json({ error: "Choose a future UAE date and time." }, { status: 400 });
    const { data: approved } = await ctx.supabase.from("approvals").select("id").eq("campaign_id", campaignId).eq("variation_id", variationId).eq("decision", "approved").limit(1).maybeSingle();
    if (!approved) return NextResponse.json({ error: "Approve this draft before scheduling it." }, { status: 409 });
    const { error } = await ctx.supabase.from("campaigns").update({ status: "scheduled", scheduled_for: scheduledFor.toISOString(), publishing_error: null }).eq("id", campaignId).eq("organization_id", ctx.membership.organization_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ status: "scheduled", scheduledFor: scheduledFor.toISOString() });
  }
  if (body.action === "reject") {
    const { error } = await ctx.supabase.from("approvals").insert({ organization_id: ctx.membership.organization_id, campaign_id: campaignId, variation_id: variationId, decision: "rejected", comment: String(body.comment||"Rejected during review"), decided_by: ctx.user.id });
    if(error)return NextResponse.json({error:error.message},{status:400});
    await ctx.supabase.from("campaigns").update({status:"changes_requested",scheduled_for:null}).eq("id",campaignId).eq("organization_id",ctx.membership.organization_id);
    return NextResponse.json({status:"changes_requested"});
  }
  if (body.action === "retry") {
    const {data:campaign}=await ctx.supabase.from("campaigns").select("settings,publishing_error").eq("id",campaignId).eq("organization_id",ctx.membership.organization_id).single();
    const isWhatsApp=campaign?.settings?.platform==="whatsapp";
    const isPreSendSetupFailure=isWhatsApp&&String(campaign?.publishing_error||"").includes("whatsapp_contacts");
    if(isWhatsApp&&!isPreSendSetupFailure)return NextResponse.json({error:"WhatsApp partial campaigns cannot be retried automatically because successful recipients must not receive duplicates."},{status:409});
    const {error}=await ctx.supabase.from("campaigns").update({status:"scheduled",scheduled_for:new Date(Date.now()-1000).toISOString(),publishing_error:null,external_post_id:null,external_post_url:null}).eq("id",campaignId).eq("organization_id",ctx.membership.organization_id);
    if(error)return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({status:"scheduled"});
  }
  if (body.action === "update_caption") {
    const caption=String(body.caption||"").trim();if(!caption)return NextResponse.json({error:"Content cannot be empty."},{status:400});
    const {data:variation}=await ctx.supabase.from("campaign_variations").select("content,platform").eq("id",variationId).eq("campaign_id",campaignId).single();
    const key=variation?.platform==="whatsapp"?"body":"caption";
    const {error}=await ctx.supabase.from("campaign_variations").update({content:{...(variation?.content||{}),[key]:caption}}).eq("id",variationId).eq("campaign_id",campaignId);
    if(error)return NextResponse.json({error:error.message},{status:400});
    await ctx.supabase.from("campaigns").update({status:"ready_for_review",scheduled_for:null,publishing_error:null}).eq("id",campaignId).eq("organization_id",ctx.membership.organization_id);
    return NextResponse.json({status:"ready_for_review"});
  }
  return NextResponse.json({ error: "Unsupported publishing action." }, { status: 400 });
}
