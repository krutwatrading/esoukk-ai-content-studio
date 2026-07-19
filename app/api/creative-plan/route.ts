import { NextResponse } from "next/server";
import { generateCreativePlan } from "@/lib/creative-engine";
import type { CreativeBrief } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const brief = (await request.json()) as CreativeBrief & {platforms?:CreativeBrief["platform"][]};
    const selected=Array.isArray(brief.platforms)?brief.platforms.filter(Boolean):brief.platform?[brief.platform]:[];
    if (!brief?.product?.title || !selected.length) {
      return NextResponse.json({ error: "Product and platform are required." }, { status: 400 });
    }
    const plans=selected.map(platform=>generateCreativePlan({...brief,platform}));
    return NextResponse.json({plans,plan:plans[0]});
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate creative plan." },
      { status: 500 }
    );
  }
}
