import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {encryptToken} from "@/lib/token-crypto";

export async function GET(request:NextRequest){
  const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://ai.esoukk.ae").replace(/\/$/,"");
  const done=(key:string,message:string)=>NextResponse.redirect(`${site}/?${key}=${encodeURIComponent(message)}#meta-publishing`);
  try{
    const code=request.nextUrl.searchParams.get("code"),state=request.nextUrl.searchParams.get("state"),expected=request.cookies.get("instagram_oauth_state")?.value;
    if(!code||!state||state!==expected)throw new Error("Invalid or expired Instagram authorization state.");
    const clientId=process.env.INSTAGRAM_APP_ID,clientSecret=process.env.INSTAGRAM_APP_SECRET;
    if(!clientId||!clientSecret)throw new Error("Instagram credentials are not configured.");
    const redirectUri=`${site}/api/meta/callback`;
    const tokenResponse=await fetch("https://api.instagram.com/oauth/access_token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:"authorization_code",redirect_uri:redirectUri,code}),cache:"no-store"});
    const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw new Error(token.error_message||"Instagram token exchange failed.");
    let accessToken=String(token.access_token),expiresAt:string|null=null;
    const exchange=await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({grant_type:"ig_exchange_token",client_secret:clientSecret,access_token:accessToken})}`,{cache:"no-store"});
    if(exchange.ok){const long=await exchange.json();if(long.access_token)accessToken=long.access_token;if(long.expires_in)expiresAt=new Date(Date.now()+Number(long.expires_in)*1000).toISOString()}
    const profileResponse=await fetch(`https://graph.instagram.com/v25.0/me?fields=user_id,username,name&access_token=${encodeURIComponent(accessToken)}`,{cache:"no-store"}),profile=await profileResponse.json();
    if(!profileResponse.ok)throw new Error(profile.error?.message||"Unable to read Instagram account.");
    const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Your studio session expired.");
    const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).single();
    if(!membership||!["owner","admin"].includes(membership.role))throw new Error("Owner or admin access is required.");
    const {error}=await supabase.from("social_connections").upsert({organization_id:membership.organization_id,provider:"instagram",provider_account_id:String(profile.user_id||profile.id||token.user_id),account_name:profile.username||profile.name||"Instagram",encrypted_access_token:encryptToken(accessToken),token_expires_at:expiresAt,scopes:["instagram_business_basic","instagram_business_content_publish"],status:"active",connected_by:user.id},{onConflict:"organization_id,provider,provider_account_id"});
    if(error)throw error;const response=done("meta","connected");response.cookies.delete("instagram_oauth_state");return response;
  }catch(error){return done("meta_error",error instanceof Error?error.message:"Instagram connection failed.")}
}
