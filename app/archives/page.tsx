import { redirect } from "next/navigation";
import AccountBar from "@/components/AccountBar";
import ArchivedCampaigns from "@/components/ArchivedCampaigns";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";

export default async function ArchivesPage(){
  const supabase=await createSupabaseServerClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:membership}=await supabase.from("organization_members").select("role").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership)redirect("/onboarding");
  return <><AccountBar email={user.email??"Signed-in user"} role={membership.role}/><ArchivedCampaigns/></>;
}
