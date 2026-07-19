import{NextResponse}from"next/server";
import{createSupabaseServerClient}from"@/lib/supabase/server";

const present=(value:string|undefined)=>Boolean(value?.trim());

export async function GET(){
 const instagramId=present(process.env.INSTAGRAM_APP_ID),instagramSecret=present(process.env.INSTAGRAM_APP_SECRET),encryptionKey=present(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY),site=(process.env.NEXT_PUBLIC_SITE_URL||"https://ai.esoukk.ae").replace(/\/$/,""),connections:Record<string,string>={};
 try{const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();if(user){const{data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).limit(1).single();if(membership){const{data:rows}=await supabase.from("social_connections").select("provider,account_name").eq("organization_id",membership.organization_id).eq("status","active");for(const row of rows||[])connections[row.provider]=row.account_name}}}catch{}
 const definitions=[
  {id:"instagram",name:"Instagram",configured:instagramId&&instagramSecret&&encryptionKey,callbackUrl:`${site}/api/meta/callback`,keys:["INSTAGRAM_APP_ID","INSTAGRAM_APP_SECRET","SOCIAL_TOKEN_ENCRYPTION_KEY"]},
  {id:"facebook",name:"Facebook",configured:present(process.env.FACEBOOK_APP_ID)&&present(process.env.FACEBOOK_APP_SECRET)&&encryptionKey,callbackUrl:`${site}/api/facebook/callback`,keys:["FACEBOOK_APP_ID","FACEBOOK_APP_SECRET","SOCIAL_TOKEN_ENCRYPTION_KEY"]},
  {id:"tiktok",name:"TikTok",configured:present(process.env.TIKTOK_CLIENT_KEY)&&present(process.env.TIKTOK_CLIENT_SECRET)&&encryptionKey,callbackUrl:`${site}/api/tiktok/callback`,keys:["TIKTOK_CLIENT_KEY","TIKTOK_CLIENT_SECRET","SOCIAL_TOKEN_ENCRYPTION_KEY"]},
  {id:"google",name:"Google / YouTube",configured:present(process.env.GOOGLE_CLIENT_ID)&&present(process.env.GOOGLE_CLIENT_SECRET)&&encryptionKey,callbackUrl:`${site}/api/google/callback`,keys:["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","SOCIAL_TOKEN_ENCRYPTION_KEY"]},
  {id:"snapchat",name:"Snapchat",configured:present(process.env.SNAPCHAT_CLIENT_ID)&&present(process.env.SNAPCHAT_CLIENT_SECRET)&&encryptionKey,callbackUrl:`${site}/api/snapchat/callback`,keys:["SNAPCHAT_CLIENT_ID","SNAPCHAT_CLIENT_SECRET","SOCIAL_TOKEN_ENCRYPTION_KEY"]}
 ],channels=definitions.map(channel=>({...channel,connected:Boolean(connections[channel.id]),accountName:connections[channel.id]||null})),instagram=channels[0];
 return NextResponse.json({configured:instagram.configured,connected:instagram.connected,connection:instagram.connected?{accountName:instagram.accountName}:null,checks:{appId:instagramId,appSecret:instagramSecret,encryptionKey},callbackUrl:instagram.callbackUrl,requiredPermissions:["instagram_business_basic","instagram_business_content_publish","instagram_business_manage_insights"],channels});
}
