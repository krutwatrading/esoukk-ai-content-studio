import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-crypto";

type Context = { organizationId?: string; actorId?: string };
const wait=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
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
      const { data: variation } = await admin.from("campaign_variations").select("content,platform").eq("id",approval.variation_id).single();
      const platform=campaign.settings?.platform==="whatsapp"?"whatsapp":"instagram";
      const { data: connection } = await admin.from("social_connections").select("provider_account_id,encrypted_access_token").eq("organization_id",campaign.organization_id).eq("provider",platform).eq("status","active").limit(1).single();
      if(platform==="whatsapp"){
        const templateName=String(variation?.content?.template_name||""),language=String(variation?.content?.template_language||"en"),imageUrl=String(variation?.content?.image_url||campaign.settings?.image_url||"");
        if(!templateName||!connection)throw new Error("Approved WhatsApp template or active WhatsApp connection is missing.");
        const {data:contacts,error:contactsError}=await admin.from("whatsapp_contacts").select("id,phone_e164,display_name").eq("organization_id",campaign.organization_id).eq("marketing_opt_in",true).is("opted_out_at",null);
        if(contactsError)throw new Error(contactsError.message);
        if(!contacts?.length)throw new Error("No contacts with explicit WhatsApp marketing opt-in are available.");
        const accessToken=decryptToken(connection.encrypted_access_token),phoneId=connection.provider_account_id;
        const successes:Array<{contactId:string;messageId:string}>=[],failures:Array<{contactId:string;error:string}>=[];
        for(const contact of contacts){
          const components:Array<Record<string,unknown>>=[];
          if(imageUrl)components.push({type:"header",parameters:[{type:"image",image:{link:imageUrl}}]});
          components.push({type:"body",parameters:[{type:"text",text:contact.display_name||"there"}]});
          const response=await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:contact.phone_e164,type:"template",template:{name:templateName,language:{code:language},components}})});
          const data=await response.json();
          if(response.ok&&data.messages?.[0]?.id)successes.push({contactId:contact.id,messageId:data.messages[0].id});
          else failures.push({contactId:contact.id,error:data.error?.message||"WhatsApp send failed."});
        }
        if(!successes.length)throw new Error(failures[0]?.error||"WhatsApp campaign failed for every opted-in contact.");
        const status=failures.length?"partially_failed":"published",firstMessage=successes[0].messageId,errorMessage=failures.length?`${failures.length} of ${contacts.length} opted-in recipients failed.`:null;
        await admin.from("campaigns").update({status,published_at:new Date().toISOString(),external_post_id:firstMessage,external_post_url:null,publishing_error:errorMessage}).eq("id",campaign.id);
        await admin.from("audit_logs").insert({organization_id:campaign.organization_id,actor_id:context.actorId||null,action:"whatsapp.published",object_type:"campaign",object_id:campaign.id,metadata:{template_name:templateName,recipient_count:contacts.length,successful:successes.length,failed:failures.length}});
        results.push({campaignId:campaign.id,status,error:errorMessage||undefined});
        continue;
      }
      const caption=String(variation?.content?.caption||""),imageUrl=String(variation?.content?.image_url||campaign.settings?.image_url||"");
      if(!caption||!imageUrl||!connection)throw new Error("Approved caption, public image or Instagram connection is missing.");
      const accessToken=decryptToken(connection.encrypted_access_token),accountId=connection.provider_account_id;
      const createResponse=await fetch(`https://graph.instagram.com/v25.0/${accountId}/media`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({image_url:imageUrl,caption,access_token:accessToken})});
      const container=await createResponse.json();if(!createResponse.ok||!container.id)throw new Error(container.error?.message||"Instagram media container creation failed.");
      let ready=false;
      for(let attempt=0;attempt<12;attempt++){
        const statusResponse=await fetch(`https://graph.instagram.com/v25.0/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`),statusData=await statusResponse.json();
        if(!statusResponse.ok)throw new Error(statusData.error?.message||"Instagram media processing status could not be checked.");
        if(statusData.status_code==="FINISHED"){ready=true;break}
        if(statusData.status_code==="ERROR"||statusData.status_code==="EXPIRED")throw new Error(statusData.status||`Instagram media processing ${String(statusData.status_code).toLowerCase()}.`);
        await wait(1500);
      }
      if(!ready)throw new Error("Instagram is still processing this image. Use Retry publishing in a moment.");
      const publishResponse=await fetch(`https://graph.instagram.com/v25.0/${accountId}/media_publish`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({creation_id:container.id,access_token:accessToken})});
      const published=await publishResponse.json();if(!publishResponse.ok||!published.id)throw new Error(published.error?.message||"Instagram publishing failed.");
      const permalinkResponse=await fetch(`https://graph.instagram.com/v25.0/${published.id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`),permalinkData=await permalinkResponse.json(),postUrl=permalinkData.permalink||null;
      await admin.from("campaigns").update({status:"published",published_at:new Date().toISOString(),external_post_id:String(published.id),external_post_url:postUrl,publishing_error:null}).eq("id",campaign.id);
      await admin.from("audit_logs").insert({organization_id:campaign.organization_id,actor_id:context.actorId||null,action:"instagram.published",object_type:"campaign",object_id:campaign.id,metadata:{instagram_media_id:published.id,permalink:postUrl}});
      results.push({campaignId:campaign.id,status:"published",postUrl:postUrl||undefined});
    } catch(error) {
      const message=error instanceof Error?error.message:"Campaign publishing failed.";
      await admin.from("campaigns").update({status:"partially_failed",publishing_error:message}).eq("id",campaign.id);
      results.push({campaignId:campaign.id,status:"failed",error:message});
    }
  }
  return NextResponse.json({processed:results.length,results});
}
export async function POST(request:NextRequest){return run(request)}
export async function GET(request:NextRequest){return run(request)}
