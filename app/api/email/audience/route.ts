import{createHash}from"crypto";
import{NextResponse}from"next/server";
import{createSupabaseAdminClient}from"@/lib/supabase/admin";
import{createSupabaseServerClient}from"@/lib/supabase/server";
import{emailBrandConfig}from"@/lib/email-brands";
export const dynamic="force-dynamic";
const hash=(email:string)=>createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
export async function GET(){
 const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in is required."},{status:401});
 const{data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
 if(!membership)return NextResponse.json({error:"Workspace membership is required."},{status:403});
 const admin=createSupabaseAdminClient(),[{data:contacts,error:contactsError},{data:suppressions,error:suppressionError}]=await Promise.all([admin.from("whatsapp_contacts").select("email,email_marketing_state").eq("organization_id",membership.organization_id).not("email","is",null),admin.from("email_suppressions").select("email_hash").eq("organization_id",membership.organization_id)]);
 if(contactsError)return NextResponse.json({error:contactsError.message},{status:400});
 if(suppressionError){const missing=suppressionError.code==="42P01";return NextResponse.json({error:missing?"Apply migration 202610170002_email_automation_foundation.sql.":suppressionError.message,setupRequired:missing},{status:missing?503:400})}
 const blocked=new Set((suppressions||[]).map(item=>item.email_hash)),withEmail=contacts||[],subscribed=withEmail.filter(item=>String(item.email_marketing_state||"").toUpperCase()==="SUBSCRIBED"),eligible=subscribed.filter(item=>!blocked.has(hash(String(item.email))));
 const kavia=emailBrandConfig("kavia"),esoukk=emailBrandConfig("esoukk"),providerChecks={apiKey:Boolean(process.env.RESEND_API_KEY),fromAddress:Boolean(kavia.sender||esoukk.sender),webhookSecret:Boolean(process.env.RESEND_WEBHOOK_SECRET),brandSenders:{kavia:Boolean(kavia.sender),esoukk:Boolean(esoukk.sender)},brandReplyTo:{kavia:Boolean(kavia.replyTo),esoukk:Boolean(esoukk.replyTo)}};
 return NextResponse.json({totalWithEmail:withEmail.length,subscribed:subscribed.length,suppressed:subscribed.length-eligible.length,eligible:eligible.length,providerConfigured:providerChecks.apiKey&&providerChecks.fromAddress&&providerChecks.webhookSecret,providerChecks},{headers:{"Cache-Control":"private, no-store"}});
}
