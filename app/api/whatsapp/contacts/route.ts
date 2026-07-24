import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Sign in is required."},{status:401});
  const{data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership)return NextResponse.json({error:"Workspace membership is required."},{status:403});
  const{count,error}=await supabase.from("whatsapp_contacts").select("id",{count:"exact",head:true}).eq("organization_id",membership.organization_id).eq("marketing_opt_in",true).is("opted_out_at",null);
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({optedIn:count||0});
}
