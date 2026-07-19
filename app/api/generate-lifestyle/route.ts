import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const directions: Record<string, string> = {
  luxury: "luxury UAE fashion editorial in refined architecture, warm champagne light",
  minimal: "minimal high-fashion studio with sculptural ivory set",
  studio: "polished commercial fashion studio, confident full-body pose",
  summer: "sunlit resort campaign, upscale summer setting",
  "uae-lifestyle": "modern Dubai lifestyle editorial, sophisticated UAE styling",
  gym: "premium fitness campaign in a modern wellness studio",
  casual: "elevated everyday street-style campaign",
  resort: "five-star UAE resort editorial, golden-hour luxury",
  "premium-black": "dramatic black fashion editorial, controlled rim lighting",
  editorial: "bold international fashion-magazine editorial",
};

export const maxDuration = 300;

async function downloadImage(url: string, name: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download ${name}.`);
  const type = response.headers.get("content-type") || "image/jpeg";
  const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  return toFile(Buffer.from(await response.arrayBuffer()), `${name}.${extension}`, { type });
}

async function uploadGeneratedImage(organizationId: string, image: string) {
  const admin = createSupabaseAdminClient();
  const path = `${organizationId}/ai/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.png`;
  const { error } = await admin.storage.from("campaign-assets").upload(path, Buffer.from(image, "base64"), {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw error;
  return admin.storage.from("campaign-assets").getPublicUrl(path).data.publicUrl;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for AI campaign generation.");
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Workspace membership is required." }, { status: 403 });

    const body = await req.json();
    const sourceUrl = String(body.productImage || "");
    if (!sourceUrl) throw new Error("A Shopify product reference image is required.");
    const productReference = await downloadImage(sourceUrl, "shopify-product-reference");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const direction = directions[body.style] || directions.luxury;
    const productContext = `Product: ${String(body.productTitle || "fashion product")}
Verified description: ${String(body.productDescription || "").slice(0, 1200)}
Creative direction: ${direction}.
CRITICAL PRODUCT FIDELITY: preserve the product's recognizable colour, silhouette, construction, neckline, sleeves, pockets, closures, proportions, print and material appearance. Do not redesign it or add features not visible in the Shopify reference.`;

    const existingImages = Array.isArray(body.existingImages) ? body.existingImages.map(String) : [];
    const targetIndexes = Array.isArray(body.targetIndexes)
      ? [...new Set<number>(body.targetIndexes.map(Number).filter((index: number) => Number.isInteger(index) && index >= 0 && index < existingImages.length))]
      : [];

    if (targetIndexes.length) {
      const corrections = String(body.corrections || "").trim();
      if (!corrections) throw new Error("Describe the requested corrections and include the image number.");
      const replacements = await Promise.all(targetIndexes.map(async index => {
        const candidate = await downloadImage(existingImages[index], `campaign-option-${index + 1}`);
        const prompt = `Revise campaign option ${index + 1} according to this client brief: ${corrections.slice(0, 1200)}
The first supplied image is the existing campaign option to revise. The second is the authoritative Shopify product reference.
${productContext}
TARGETED REVISION: change only what the client requested for image ${index + 1}. Preserve all successful aspects of that existing option unless the brief explicitly changes them. Produce exactly one polished photorealistic vertical 4:5 campaign photograph in one continuous scene. Never create a grid, split screen, contact sheet, diptych, triptych or multi-panel collage unless the client explicitly requests that format. No text, logos, watermark or border.`;
        const result = await client.images.edit({ model, image: [candidate, productReference], prompt, size: "1024x1536", quality: "medium", n: 1 });
        const image = result.data?.[0]?.b64_json;
        if (!image) throw new Error(`No revised image was returned for option ${index + 1}.`);
        return { index, imageUrl: await uploadGeneratedImage(membership.organization_id, image) };
      }));
      return NextResponse.json({ replacements, model });
    }

    const prompt = `Create one premium ecommerce campaign photograph using the supplied image only as the product reference. This API request will return multiple separate outputs, so this individual output must contain exactly one photograph.
${productContext}
NEW CREATIVE: generate one photorealistic adult fashion model, one pose, one camera composition and one continuous environment. It must look newly photographed, never like the source pasted onto a background. Show the complete product clearly and naturally worn or carried, with the entire product inside the frame and safe margin around it. Premium vertical Instagram 4:5 composition. Realistic anatomy, hands, fabric drape, shadows and skin. Return exactly one single scene: never a grid, split screen, contact sheet, diptych, triptych or multi-panel collage. No text, logos, watermark, border, duplicated person or extra product.`;
    const result = await client.images.edit({ model, image: productReference, prompt, size: "1024x1536", quality: "medium", n: 4 });
    const images = (result.data || []).map(item => item.b64_json).filter((item): item is string => Boolean(item));
    if (!images.length) throw new Error("No AI campaign images were returned.");
    const imageUrls = await Promise.all(images.map(image => uploadGeneratedImage(membership.organization_id, image)));
    return NextResponse.json({ imageUrl: imageUrls[0], imageUrls, model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the campaign images." }, { status: 400 });
  }
}
