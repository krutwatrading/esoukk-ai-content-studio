import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {registerProductWebhooks} from "@/lib/shopify-admin";

export async function POST(){
  try{
    const supabase=await createSupabaseServerClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
    const {data:membership}=await supabase.from("organization_members").select("role").eq("user_id",user.id).limit(1).maybeSingle();
    if(!membership||!["owner","admin"].includes(membership.role))return NextResponse.json({error:"Owner or admin access is required."},{status:403});
    const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL||"https://ai.esoukk.ae").replace(/\/$/,"");
    const topics=await registerProductWebhooks(`${siteUrl}/api/shopify/webhooks`);
    return NextResponse.json({ok:true,topics,message:"Shopify product automation is active."});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to register webhooks."},{status:400})}
}
