import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {encryptToken} from "@/lib/token-crypto";

type FacebookPage={id:string;name?:string;access_token?:string;tasks?:string[]};

export async function GET(request:NextRequest){
  const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://ai.esoukk.ae").trim().replace(/\/$/,"");
  const done=(key:string,message:string)=>NextResponse.redirect(`${site}/?${key}=${encodeURIComponent(message)}#meta-publishing`);
  try{
    const oauthError=request.nextUrl.searchParams.get("error"),description=request.nextUrl.searchParams.get("error_description");
    if(oauthError)throw new Error(description||oauthError);
    const code=request.nextUrl.searchParams.get("code"),state=request.nextUrl.searchParams.get("state"),expected=request.cookies.get("facebook_oauth_state")?.value;
    if(!code||!state||state!==expected)throw new Error("Invalid or expired Facebook authorization state.");
    const clientId=process.env.FACEBOOK_APP_ID?.trim(),clientSecret=process.env.FACEBOOK_APP_SECRET?.trim();
    if(!clientId||!clientSecret)throw new Error("Facebook credentials are not configured.");
    const redirectUri=`${site}/api/facebook/callback`;
    const tokenUrl=new URL("https://graph.facebook.com/v25.0/oauth/access_token");
    tokenUrl.search=new URLSearchParams({client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,code}).toString();
    const tokenResponse=await fetch(tokenUrl,{cache:"no-store"}),shortToken=await tokenResponse.json();
    if(!tokenResponse.ok||!shortToken.access_token)throw new Error(shortToken.error?.message||"Facebook token exchange failed.");
    const exchangeUrl=new URL("https://graph.facebook.com/v25.0/oauth/access_token");
    exchangeUrl.search=new URLSearchParams({grant_type:"fb_exchange_token",client_id:clientId,client_secret:clientSecret,fb_exchange_token:String(shortToken.access_token)}).toString();
    const exchangeResponse=await fetch(exchangeUrl,{cache:"no-store"}),longToken=await exchangeResponse.json();
    const userToken=String(longToken.access_token||shortToken.access_token),expiresAt=longToken.expires_in?new Date(Date.now()+Number(longToken.expires_in)*1000).toISOString():null;
    const pagesResponse=await fetch(`https://graph.facebook.com/v25.0/me/accounts?${new URLSearchParams({fields:"id,name,access_token,tasks",limit:"100",access_token:userToken})}`,{cache:"no-store"}),pagesPayload=await pagesResponse.json();
    if(!pagesResponse.ok)throw new Error(pagesPayload.error?.message||"Unable to read Facebook Pages.");
    const pages=(Array.isArray(pagesPayload.data)?pagesPayload.data:[]) as FacebookPage[];
    const configuredPageId=process.env.FACEBOOK_PAGE_ID?.trim()||"248613811675766";
    const configuredBusinessId=process.env.FACEBOOK_BUSINESS_ID?.trim()||"379816178202668";
    if(!pages.some(page=>page.id===configuredPageId&&page.access_token)){
      const businessPagesResponse=await fetch(`https://graph.facebook.com/v25.0/${encodeURIComponent(configuredBusinessId)}/owned_pages?${new URLSearchParams({fields:"id,name,access_token,tasks",limit:"100",access_token:userToken})}`,{cache:"no-store"});
      const businessPagesPayload=await businessPagesResponse.json();
      if(businessPagesResponse.ok&&Array.isArray(businessPagesPayload.data))pages.push(...businessPagesPayload.data as FacebookPage[]);
    }
    if(!pages.some(page=>page.id===configuredPageId&&page.access_token)){
      const pageResponse=await fetch(`https://graph.facebook.com/v25.0/${encodeURIComponent(configuredPageId)}?${new URLSearchParams({fields:"id,name,access_token,tasks",access_token:userToken})}`,{cache:"no-store"});
      const pagePayload=await pageResponse.json();
      if(pageResponse.ok&&pagePayload?.id&&pagePayload?.access_token)pages.push(pagePayload as FacebookPage);
    }
    // Meta returns different `tasks` labels for classic Pages and the New Pages
    // Experience (for example PROFILE_PLUS_FULL_CONTROL). A Page access token is
    // the authoritative signal here; pages_manage_posts is validated by Meta
    // again when content is published.
    const eligible=pages.filter(page=>page.id&&page.access_token);
    if(!eligible.length)throw new Error("Meta approved the eSoukk Page but did not issue its Page access token. Remove the existing eSoukk AI Content Studio entry from Facebook Business Integrations, then reconnect it.");
    const preferred=eligible.find(page=>String(page.name||"").toLowerCase().includes("esoukk"))||eligible[0];
    const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
    if(!user)throw new Error("Your studio session expired.");
    const{data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).single();
    if(!membership||!["owner","admin"].includes(membership.role))throw new Error("Owner or admin access is required.");
    const{error}=await supabase.from("social_connections").upsert({organization_id:membership.organization_id,provider:"facebook",provider_account_id:String(preferred.id),account_name:preferred.name||"Facebook Page",encrypted_access_token:encryptToken(String(preferred.access_token)),token_expires_at:expiresAt,scopes:["pages_show_list","pages_read_engagement","pages_manage_posts","business_management"],status:"active",connected_by:user.id},{onConflict:"organization_id,provider,provider_account_id"});
    if(error)throw error;
    const response=done("facebook","connected");response.cookies.delete("facebook_oauth_state");return response;
  }catch(error){return done("facebook_error",error instanceof Error?error.message:"Facebook connection failed.")}
}
