import{NextResponse}from"next/server";
import{createSupabaseServerClient}from"@/lib/supabase/server";
import{encryptToken}from"@/lib/token-crypto";

export async function GET(){
 const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://ai.esoukk.ae").replace(/\/$/,"");
 const done=(key:string,message:string)=>NextResponse.redirect(`${site}/?${key}=${encodeURIComponent(message)}#meta-publishing`);
 try{
  const token=process.env.WHATSAPP_ACCESS_TOKEN?.trim(),phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),businessId=process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if(!token||!phoneId||!businessId)throw new Error("Add the WhatsApp token, Phone Number ID and Business Account ID in Vercel first.");
  const graph=process.env.META_GRAPH_VERSION||"v25.0",response=await fetch(`https://graph.facebook.com/${graph}/${phoneId}?fields=display_phone_number,verified_name,quality_rating`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"}),profile=await response.json();
  if(!response.ok||!profile.id)throw new Error(profile.error?.message||"WhatsApp could not verify this business number.");
  const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sign in to the studio before connecting WhatsApp.");
  const{data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).single();
  if(!membership||!["owner","admin"].includes(membership.role))throw new Error("Owner or admin access is required.");
  const{error}=await supabase.from("social_connections").upsert({organization_id:membership.organization_id,provider:"whatsapp",provider_account_id:String(phoneId),account_name:profile.display_phone_number||profile.verified_name||"WhatsApp Business",encrypted_access_token:encryptToken(token),scopes:["whatsapp_business_messaging","whatsapp_business_management"],status:"active",connected_by:user.id},{onConflict:"organization_id,provider,provider_account_id"});
  if(error)throw error;
  return done("whatsapp","connected");
 }catch(error){return done("whatsapp_error",error instanceof Error?error.message:"WhatsApp connection failed.")}
}
