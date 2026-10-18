import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
type EventRow={event_type:string;created_at:string;metadata:Record<string,unknown>|null};

export async function GET(){
 const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in is required."},{status:401});
 const{data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
 if(!membership)return NextResponse.json({error:"Workspace membership is required."},{status:403});
 const admin=createSupabaseAdminClient();
 const[{data:campaigns,error:campaignError},{data:events,error:eventError},{data:ledger,error:ledgerError},{count:suppressed,error:suppressionError}]=await Promise.all([
  admin.from("campaigns").select("id,name,status,settings,scheduled_for,published_at,publishing_error,created_at").eq("organization_id",membership.organization_id).filter("settings->>channel","eq","email").order("created_at",{ascending:false}).limit(20),
  admin.from("email_delivery_events").select("event_type,created_at,metadata").eq("organization_id",membership.organization_id).order("created_at",{ascending:false}).limit(2000),
  admin.from("email_campaign_recipients").select("campaign_id,status").eq("organization_id",membership.organization_id),
  admin.from("email_suppressions").select("id",{count:"exact",head:true}).eq("organization_id",membership.organization_id),
 ]);
 const missing=[campaignError,eventError,ledgerError,suppressionError].find(error=>error?.code==="42P01");
 if(missing)return NextResponse.json({error:"Apply the Phase 11 email migrations in Supabase before loading reports.",setupRequired:true},{status:503});
 const failure=campaignError||eventError||ledgerError||suppressionError;if(failure)return NextResponse.json({error:failure.message},{status:500});
 const eventCounts=new Map<string,Record<string,number>>(),recipientCounts=new Map<string,Record<string,number>>(),totals:Record<string,number>={};
 for(const event of (events||[]) as EventRow[]){totals[event.event_type]=(totals[event.event_type]||0)+1;const campaignId=String(event.metadata?.campaign_id||"");if(!campaignId)continue;const counts=eventCounts.get(campaignId)||{};counts[event.event_type]=(counts[event.event_type]||0)+1;eventCounts.set(campaignId,counts)}
 for(const recipient of ledger||[]){const counts=recipientCounts.get(recipient.campaign_id)||{};counts[recipient.status]=(counts[recipient.status]||0)+1;recipientCounts.set(recipient.campaign_id,counts)}
 return NextResponse.json({totals,suppressed:suppressed||0,campaigns:(campaigns||[]).map(campaign=>({id:campaign.id,name:campaign.name,status:campaign.status,brand:campaign.settings?.brand||"kavia",scheduledFor:campaign.scheduled_for,publishedAt:campaign.published_at,error:campaign.publishing_error,events:eventCounts.get(campaign.id)||{},recipients:recipientCounts.get(campaign.id)||{}}))});
}
