import{createHash}from"crypto";
import{NextResponse}from"next/server";
import{Resend,type WebhookEventPayload}from"resend";
import{createSupabaseAdminClient}from"@/lib/supabase/admin";

export const runtime="nodejs";
const hash=(email:string)=>createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const emailEvents=new Set(["email.sent","email.delivered","email.delivery_delayed","email.complained","email.bounced","email.failed","email.suppressed"]);
const suppressionEvents=new Set(["email.complained","email.bounced","email.suppressed"]);

function eventDetails(event:WebhookEventPayload){
 if(emailEvents.has(event.type)){const data=event.data as{email_id?:string;to?:string[];tags?:Record<string,string>};return{organizationId:data.tags?.organization_id||null,providerEmailId:data.email_id||null,emails:data.to||[]}}
 if(event.type==="contact.updated"){return{organizationId:null,providerEmailId:null,emails:event.data.unsubscribed?[event.data.email]:[]}}
 if(event.type==="suppression.added"){return{organizationId:null,providerEmailId:event.data.source_id,emails:[event.data.email]}}
 return{organizationId:null,providerEmailId:null,emails:[] as string[]};
}

export async function POST(request:Request){
 const secret=process.env.RESEND_WEBHOOK_SECRET;if(!secret)return NextResponse.json({error:"Webhook is not configured."},{status:503});
 const payload=await request.text(),id=request.headers.get("svix-id"),timestamp=request.headers.get("svix-timestamp"),signature=request.headers.get("svix-signature");
 if(!id||!timestamp||!signature)return NextResponse.json({error:"Missing webhook signature headers."},{status:400});
 let event:WebhookEventPayload;try{event=new Resend(process.env.RESEND_API_KEY||"re_webhook_verification").webhooks.verify({payload,headers:{id,timestamp,signature},webhookSecret:secret})}catch{return NextResponse.json({error:"Invalid webhook signature."},{status:401})}
 const admin=createSupabaseAdminClient(),details=eventDetails(event);let organizationIds=details.organizationId?[details.organizationId]:[];
 if(!organizationIds.length&&details.emails.length){const{data:matches}=await admin.from("whatsapp_contacts").select("organization_id,email").in("email",details.emails);organizationIds=[...new Set((matches||[]).map(item=>item.organization_id))]}
 const recipientHash=details.emails[0]?hash(details.emails[0]):null;
 const metadata={occurred_at:event.created_at,recipient_count:details.emails.length};
 const{error:eventError}=await admin.from("email_delivery_events").upsert({provider_event_id:id,organization_id:organizationIds[0]||null,provider_email_id:details.providerEmailId,event_type:event.type,recipient_hash:recipientHash,metadata},{onConflict:"provider_event_id",ignoreDuplicates:true});
 if(eventError)return NextResponse.json({error:eventError.code==="42P01"?"Email delivery migration is not installed.":"Unable to record delivery event."},{status:503});
 const shouldSuppress=suppressionEvents.has(event.type)||(event.type==="contact.updated"&&event.data.unsubscribed)||event.type==="suppression.added";
 if(shouldSuppress&&organizationIds.length&&details.emails.length){const rows=organizationIds.flatMap(organizationId=>details.emails.map(email=>({organization_id:organizationId,email_hash:hash(email),reason:event.type,source:"resend_webhook"})));const{error}=await admin.from("email_suppressions").upsert(rows,{onConflict:"organization_id,email_hash"});if(error)return NextResponse.json({error:"Unable to update email suppression."},{status:500})}
 return NextResponse.json({received:true});
}
