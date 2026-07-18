import {createHmac,timingSafeEqual} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";

export const runtime="nodejs";
function validHmac(body:string,received:string|null){if(!received||!process.env.SHOPIFY_CLIENT_SECRET)return false;const expected=createHmac("sha256",process.env.SHOPIFY_CLIENT_SECRET).update(body,"utf8").digest("base64");const a=Buffer.from(expected),b=Buffer.from(received);return a.length===b.length&&timingSafeEqual(a,b)}
function plain(value:string|undefined){return(value||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim()}

export async function POST(request:NextRequest){
  const raw=await request.text();
  if(!validHmac(raw,request.headers.get("x-shopify-hmac-sha256")))return NextResponse.json({error:"Invalid webhook signature."},{status:401});
  try{
    const product=JSON.parse(raw),topic=request.headers.get("x-shopify-topic")||"products/update",webhookId=request.headers.get("x-shopify-webhook-id");
    const supabase=createSupabaseAdminClient();
    const {data:organization,error:organizationError}=await supabase.from("organizations").select("id").order("created_at").limit(1).single();
    if(organizationError||!organization)throw new Error("No organization is configured.");
    const variants=(product.variants||[]).map((variant:{id:number;title:string;price:string;available?:boolean;inventory_quantity?:number})=>({id:variant.id,title:variant.title,price:Number(variant.price||0),available:variant.available??Number(variant.inventory_quantity||0)>0}));
    const images=(product.images||[]).map((image:{src:string})=>image.src).filter(Boolean);
    const snapshot={title:product.title,handle:product.handle,url:`https://esoukk.ae/products/${product.handle}`,vendor:product.vendor,productType:product.product_type,description:plain(product.body_html),price:variants.length?Math.min(...variants.map((variant:{price:number})=>variant.price)):0,currency:"AED",images,variants};
    const {error}=await supabase.from("products").upsert({organization_id:organization.id,shopify_product_id:String(product.admin_graphql_api_id||product.id),handle:product.handle,url:snapshot.url,title:product.title,status:String(product.status||"").toUpperCase(),snapshot,shopify_updated_at:product.updated_at||new Date().toISOString()},{onConflict:"organization_id,handle"});
    if(error)throw error;
    await supabase.from("audit_logs").insert({organization_id:organization.id,action:topic.replace("/","."),object_type:"product",object_id:String(product.id),metadata:{webhook_id:webhookId,handle:product.handle}});
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Webhook processing failed."},{status:500})}
}
