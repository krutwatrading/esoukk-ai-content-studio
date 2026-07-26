import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function context(){
  const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)return {error:NextResponse.json({error:"Sign in is required."},{status:401})};
  const{data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership)return {error:NextResponse.json({error:"Workspace membership is required."},{status:403})};
  if(!["owner","admin"].includes(membership.role))return {error:NextResponse.json({error:"Owner or admin access is required."},{status:403})};
  return {supabase,membership};
}

function tableError(message:string){
  const missing=message.includes("whatsapp_contacts")&&message.includes("schema cache");
  return NextResponse.json({error:missing?"WhatsApp contacts storage is not installed yet. Apply the latest Supabase migration, then refresh this page.":message},{status:missing?503:400});
}

function normalisePhone(value:string){
  const phone=value.trim().replace(/[\s()-]/g,"");
  return /^\+[1-9]\d{7,14}$/.test(phone)?phone:"";
}

export async function GET(){
  const ctx=await context();if(ctx.error)return ctx.error;
  const{data,error}=await ctx.supabase.from("whatsapp_contacts")
    .select("id,phone_e164,email,display_name,first_name,last_name,country,country_code,locale,marketing_opt_in,opt_in_source,opted_in_at,opted_out_at,shopify_customer_id,email_marketing_state,sms_marketing_state,shopify_tags,synced_at")
    .eq("organization_id",ctx.membership.organization_id).order("created_at",{ascending:false});
  if(error)return tableError(error.message);
  const contacts=data||[],optedIn=contacts.filter(contact=>contact.marketing_opt_in&&!contact.opted_out_at).length;
  return NextResponse.json({contacts,optedIn,total:contacts.length});
}

export async function POST(request:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  const body=await request.json(),phone=normalisePhone(String(body.phone||""));
  if(!phone)return NextResponse.json({error:"Enter the phone in international format, for example +971501234567."},{status:400});
  if(body.marketingOptInConfirmed!==true)return NextResponse.json({error:"Explicit WhatsApp marketing consent must be confirmed before this contact can be added."},{status:400});
  const now=new Date().toISOString();
  const{data,error}=await ctx.supabase.from("whatsapp_contacts").upsert({
    organization_id:ctx.membership.organization_id,phone_e164:phone,
    display_name:String(body.displayName||"").trim()||null,locale:String(body.locale||"en").trim()||"en",
    marketing_opt_in:true,opt_in_source:"admin_explicit_confirmation",opted_in_at:now,opted_out_at:null,updated_at:now
  },{onConflict:"organization_id,phone_e164"}).select("id").single();
  if(error)return tableError(error.message);
  return NextResponse.json({contact:data});
}

export async function PATCH(request:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  const body=await request.json(),enabled=body.marketingOptIn===true;
  if(!body.id)return NextResponse.json({error:"Contact ID is required."},{status:400});
  if(enabled&&body.marketingOptInConfirmed!==true)return NextResponse.json({error:"Confirm explicit consent before enabling WhatsApp marketing."},{status:400});
  const now=new Date().toISOString(),changes=enabled
    ?{marketing_opt_in:true,opt_in_source:"admin_explicit_confirmation",opted_in_at:now,opted_out_at:null,updated_at:now}
    :{marketing_opt_in:false,opted_out_at:now,updated_at:now};
  const{error}=await ctx.supabase.from("whatsapp_contacts").update(changes).eq("id",body.id).eq("organization_id",ctx.membership.organization_id);
  if(error)return tableError(error.message);
  return NextResponse.json({ok:true});
}

export async function DELETE(request:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"Contact ID is required."},{status:400});
  const{error}=await ctx.supabase.from("whatsapp_contacts").delete().eq("id",id).eq("organization_id",ctx.membership.organization_id);
  if(error)return tableError(error.message);
  return NextResponse.json({ok:true});
}
