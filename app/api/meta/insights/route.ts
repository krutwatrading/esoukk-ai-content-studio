import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-crypto";

type MetricMap=Record<string,number>;

async function context(){
  const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)return null;
  const{data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();
  return membership?{supabase,user,membership}:null;
}
function missingTable(error:{code?:string;message?:string}|null){return error?.code==="42P01"||Boolean(error?.message?.includes("campaign_metric_snapshots"))}
function latestByCampaign(rows:Array<Record<string,unknown>>){const seen=new Set<string>();return rows.filter(row=>{const id=String(row.campaign_id);if(seen.has(id))return false;seen.add(id);return true})}

export async function GET(){
  const ctx=await context();if(!ctx)return NextResponse.json({error:"Sign in is required."},{status:401});
  const{data:rows,error}=await ctx.supabase.from("campaign_metric_snapshots").select("campaign_id,views,reach,likes,comments,saves,shares,total_interactions,engagement_rate,captured_at,campaigns(name,external_post_url,product_snapshot,published_at)").eq("organization_id",ctx.membership.organization_id).order("captured_at",{ascending:false}).limit(250);
  if(missingTable(error))return NextResponse.json({setupRequired:true,metrics:[]});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({setupRequired:false,metrics:latestByCampaign((rows||[]) as Array<Record<string,unknown>>)});
}

export async function POST(){
  const ctx=await context();if(!ctx)return NextResponse.json({error:"Sign in is required."},{status:401});
  if(!["owner","admin"].includes(ctx.membership.role))return NextResponse.json({error:"An owner or admin must sync performance."},{status:403});
  const admin=createSupabaseAdminClient();
  const{data:campaigns,error:campaignError}=await admin.from("campaigns").select("id,name,external_post_id").eq("organization_id",ctx.membership.organization_id).eq("status","published").not("external_post_id","is",null).order("published_at",{ascending:false}).limit(30);
  if(campaignError)return NextResponse.json({error:campaignError.message},{status:400});
  if(!campaigns?.length)return NextResponse.json({synced:0,message:"Publish at least one Instagram post before syncing performance."});
  const{data:connection,error:connectionError}=await admin.from("social_connections").select("encrypted_access_token,scopes").eq("organization_id",ctx.membership.organization_id).eq("provider","instagram").eq("status","active").limit(1).maybeSingle();
  if(connectionError||!connection)return NextResponse.json({error:"Connect Instagram before syncing insights."},{status:409});
  const token=decryptToken(connection.encrypted_access_token),snapshots=[];
  for(const campaign of campaigns){
    const url=`https://graph.instagram.com/v25.0/${campaign.external_post_id}/insights?metric=views,reach,likes,comments,saved,shares,total_interactions&access_token=${encodeURIComponent(token)}`;
    const response=await fetch(url,{cache:"no-store"}),payload=await response.json();
    if(!response.ok){const message=payload.error?.message||"Instagram Insights request failed.";return NextResponse.json({error:message,reconnectRequired:true},{status:403})}
    const values:MetricMap={};for(const metric of payload.data||[])values[String(metric.name)]=Number(metric.values?.[0]?.value??metric.value??0);
    const interactions=values.total_interactions??((values.likes||0)+(values.comments||0)+(values.saved||0)+(values.shares||0));
    snapshots.push({organization_id:ctx.membership.organization_id,campaign_id:campaign.id,provider:"instagram",external_post_id:campaign.external_post_id,views:values.views||0,reach:values.reach||0,likes:values.likes||0,comments:values.comments||0,saves:values.saved||0,shares:values.shares||0,total_interactions:interactions,engagement_rate:values.reach?Number(((interactions/values.reach)*100).toFixed(4)):0});
  }
  const{error}=await admin.from("campaign_metric_snapshots").insert(snapshots);
  if(missingTable(error))return NextResponse.json({error:"Run the Phase 5 Supabase migration first.",setupRequired:true},{status:409});
  if(error)return NextResponse.json({error:error.message},{status:400});
  await admin.from("audit_logs").insert({organization_id:ctx.membership.organization_id,actor_id:ctx.user.id,action:"instagram.insights_synced",object_type:"organization",object_id:ctx.membership.organization_id,metadata:{campaigns:snapshots.length}});
  return NextResponse.json({synced:snapshots.length});
}
