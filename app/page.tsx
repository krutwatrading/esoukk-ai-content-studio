import { redirect } from "next/navigation";
import ContentStudio from "@/components/ContentStudio";
import AccountBar from "@/components/AccountBar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BrandProfile } from "@/lib/types";

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

  const { data: savedBrand } = await supabase.from("brand_profiles").select("store_name, website_url, voice, audiences, approved_ctas, prohibited_claims").eq("organization_id", membership.organization_id).maybeSingle();
  const brandProfile: BrandProfile = savedBrand ? {
    storeName: savedBrand.store_name, websiteUrl: savedBrand.website_url ?? "",
    voice: savedBrand.voice as string[], audiences: savedBrand.audiences as string[],
    approvedCtas: savedBrand.approved_ctas as string[], prohibitedClaims: savedBrand.prohibited_claims as string[],
  } : {storeName:"eSoukk",websiteUrl:"https://esoukk.ae",voice:["Premium but approachable","Confident and feminine","Clear rather than exaggerated","UAE-relevant"],audiences:["Women in the UAE seeking premium, affordable fashion"],approvedCtas:["Shop Now","Discover the Edit","View Product"],prohibitedClaims:["Unverified fabric or origin claims","Medical, shaping or performance claims","Unverified discounts, delivery or stock claims"]};

  return <><AccountBar email={user.email ?? "Signed-in user"} role={membership.role}/><ContentStudio initialBrandProfile={brandProfile}/></>;
}
