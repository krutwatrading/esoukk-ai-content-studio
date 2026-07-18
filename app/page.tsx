import { redirect } from "next/navigation";
import ContentStudio from "@/components/ContentStudio";
import AccountBar from "@/components/AccountBar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  return <><AccountBar email={user.email ?? "Signed-in user"} role={membership.role}/><ContentStudio/></>;
}
