import { redirect } from "next/navigation";
import { createOrganization } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membership) redirect("/");
  const params = await searchParams;
  return <main className="onboarding-page"><section className="onboarding-card"><span>ONE LAST STEP</span><h1>Create your private workspace.</h1><p>This separates your products, campaigns and approvals from every other organization.</p>{params.error&&<div className="auth-alert error">{params.error}</div>}<form action={createOrganization}><label>Workspace name<input name="name" defaultValue="eSoukk AI" required/></label><label>Workspace URL name<input name="slug" defaultValue="esoukk-ai" required/><small>Lowercase letters, numbers and hyphens only.</small></label><button type="submit">Create workspace →</button></form></section></main>;
}
