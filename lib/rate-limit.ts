import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RateLimitResult={allowed:boolean;remaining:number;resetAt:string};

export async function enforceRateLimit(action:string,limit:number,windowSeconds:number){
  const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)return {response:NextResponse.json({error:"Sign in is required."},{status:401})};
  const{data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership)return {response:NextResponse.json({error:"Workspace membership is required."},{status:403})};
  const admin=createSupabaseAdminClient(),key=`${membership.organization_id}:${user.id}:${action}`;
  const{data,error}=await admin.rpc("consume_api_rate_limit",{p_rate_key:key,p_limit:limit,p_window_seconds:windowSeconds});
  if(error){
    const missing=error.code==="PGRST202"||error.code==="42883"||/consume_api_rate_limit/i.test(error.message||"");
    return {response:NextResponse.json({error:missing?"Production rate limiting is not installed. Apply migration 202610170001_production_hardening.sql.":"Rate-limit verification failed.",setupRequired:missing},{status:503})};
  }
  const result=data as RateLimitResult;
  if(!result.allowed){
    const retryAfter=Math.max(1,Math.ceil((new Date(result.resetAt).getTime()-Date.now())/1000));
    return {response:NextResponse.json({error:"Too many requests. Please wait before trying again.",retryAfter},{status:429,headers:{"Retry-After":String(retryAfter),"X-RateLimit-Remaining":"0"}})};
  }
  return {user,organizationId:membership.organization_id,headers:{"X-RateLimit-Remaining":String(result.remaining),"X-RateLimit-Reset":result.resetAt}};
}
