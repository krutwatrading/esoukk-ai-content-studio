import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-crypto";

type Context = { organizationId?: string; actorId?: string };
async function authorize(request: NextRequest): Promise<Context | null> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) return {};
  const supabase = await createSupabaseServerClient(), { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || !["owner","admin","approver"].includes(membership.role)) return null;
  return { organizationId: membership.organization_id, actorId: user.id };
}

async function run(request: NextRequest) {
  const context = await authorize(request);
  if (!context) return NextResponse.json({ error: "Publishing authorization failed." }, { status: 401 });
  const admin = createSupabaseAdminClient(), now = new Date().toISOString();
  let query = admin.from("campaigns").select("id,organization_id,name,settings,scheduled_for,publish_attempts").eq("status","scheduled").lte("scheduled_for",now).is("external_post_id",null).order("scheduled_for").limit(5);
  if (context.organizationId) query = query.eq("organization_id", context.organizationId);
  const selectedCampaign=request.nextUrl.searchParams.get("campaignId");if(selectedCampaign)query=query.eq("id",selectedCampaign);
  const { data: campaigns, error: campaignError } = await query;
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  const results: Array<{campaignId:string;status:string;postUrl?:string;error?:string}> = [];
  for (const campaign of campaigns || []) {
    const claimed = await admin.from("campaigns").update({ status:"publishing",publish_attempts:(campaign.publish_attempts||0)+1,publishing_error:null }).eq("id",campaign.id).eq("status","scheduled").select("id").maybeSingle();
    if (!claimed.data) continue;
    try {
      const { data: approval } = await admin.from("approvals").select("variation_id").eq("campaign_id",campaign.id).eq("decision","approved").order("created_at",{ascending:false}).limit(1).maybeSingle();
      if (!approval) throw new Error("No recorded approval was found.");
      const { data: variation } = await admin.from("campaign_variations").select("content").eq("id",approval.variation_id).single();
      const { data: connection } = await admin.from("social_connections").select("provider_account_id,encrypted_access_token").eq("organization_id",campaign.organization_id).eq("provider","instagram").eq("status","active").limit(1).single();
      const caption=String(variation?.content?.caption||""),imageUrl=String(variation?.content?.image_url||campaign.settings?.image_url||"");
      if(!caption||!imageUrl||!connection)throw new Error("Approved caption, public image or Instagram connection is missing.");
      const accessToken=decryptToken(connection.encrypted_access_token),accountId=connection.provider_account_id;
      const createResponse=await fetch(`https://graph.instagram.com/v25.0/${accountId}/media`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({image_url:imageUrl,caption,access_token:accessToken})});
      const container=await createResponse.json();if(!createResponse.ok||!container.id)throw new Error(container.error?.message||"Instagram media container creation failed.");
      const publishResponse=await fetch(`https://graph.instagram.com/v25.0/${accountId}/media_publish`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({creation_id:container.id,access_token:accessToken})});
      const published=await publishResponse.json();if(!publishResponse.ok||!published.id)throw new Error(published.error?.message||"Instagram publishing failed.");
      const permalinkResponse=await fetch(`https://graph.instagram.com/v25.0/${published.id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`),permalinkData=await permalinkResponse.json(),postUrl=permalinkData.permalink||null;
      await admin.from("campaigns").update({status:"published",published_at:new Date().toISOString(),external_post_id:String(published.id),external_post_url:postUrl,publishing_error:null}).eq("id",campaign.id);
      await admin.from("audit_logs").insert({organization_id:campaign.organization_id,actor_id:context.actorId||null,action:"instagram.published",object_type:"campaign",object_id:campaign.id,metadata:{instagram_media_id:published.id,permalink:postUrl}});
      results.push({campaignId:campaign.id,status:"published",postUrl:postUrl||undefined});
    } catch(error) {
      const message=error instanceof Error?error.message:"Instagram publishing failed.";
      await admin.from("campaigns").update({status:"partially_failed",publishing_error:message}).eq("id",campaign.id);
      results.push({campaignId:campaign.id,status:"failed",error:message});
    }
  }
  return NextResponse.json({processed:results.length,results});
}
export async function POST(request:NextRequest){return run(request)}
export async function GET(request:NextRequest){return run(request)}
