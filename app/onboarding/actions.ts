"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (name.length < 2 || slug.length < 2) redirect("/onboarding?error=Enter a valid workspace name.");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("create_organization", { organization_name: name, organization_slug: slug });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}
