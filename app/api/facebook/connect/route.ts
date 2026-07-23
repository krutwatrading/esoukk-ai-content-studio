import {randomBytes} from "crypto";
import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function GET(){
  const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://ai.esoukk.ae").trim().replace(/\/$/,"");
  const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.redirect(new URL("/login",site));
  const clientId=process.env.FACEBOOK_APP_ID?.trim();
  if(!clientId)return NextResponse.json({error:"FACEBOOK_APP_ID is not configured."},{status:503});
  const state=randomBytes(24).toString("base64url"),redirectUri=`${site}/api/facebook/callback`;
  const url=new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,state,response_type:"code",scope:"pages_show_list,pages_read_engagement,pages_manage_posts,business_management",auth_type:"rerequest"}).toString();
  const response=NextResponse.redirect(url);
  response.cookies.set("facebook_oauth_state",state,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
  return response;
}
