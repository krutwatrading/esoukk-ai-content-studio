import { NextResponse } from "next/server";
import { generateCreativePlan } from "@/lib/creative-engine";
import type { CreativeBrief } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const brief = (await request.json()) as CreativeBrief;
    if (!brief?.product?.title || !brief?.platform) {
      return NextResponse.json({ error: "Product and platform are required." }, { status: 400 });
    }
    return NextResponse.json({ plan: generateCreativePlan(brief) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate creative plan." },
      { status: 500 }
    );
  }
}
