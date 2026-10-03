import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const maxDuration=60;

async function authorized(){const supabase=await createSupabaseServerClient();const{data:{user}}=await supabase.auth.getUser();return user}
async function referenceFile(url:string){
 if(url.startsWith("data:")){const match=url.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);if(!match)throw new Error("The selected reference image is not supported.");return new Blob([Buffer.from(match[2],"base64")],{type:match[1]})}
 const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error("The selected product image could not be loaded.");const type=response.headers.get("content-type")||"image/jpeg";if(!type.startsWith("image/"))throw new Error("The selected reference is not an image.");return new Blob([await response.arrayBuffer()],{type})
}
export async function POST(request:NextRequest){
 if(!await authorized())return NextResponse.json({error:"Sign in is required."},{status:401});
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"OPENAI_API_KEY is required for AI video generation."},{status:503});
 try{const body=await request.json(),product=body.product||{},campaign=body.campaign||{},script=String(body.script||"").trim(),imageUrl=String(body.imageUrl||"");if(!script||!imageUrl)return NextResponse.json({error:"A selected script and product image are required."},{status:400});
  const prompt=`Create a polished vertical social-commerce video using the reference product as the exact hero. This must be genuine moving footage, not a still-image slideshow, not a poster and not a text card. Show natural camera movement, multiple distinct product-focused shots, realistic interaction and coherent scene transitions. Preserve the product's visible shape, colour and construction. Do not add claims or on-screen text. Include tasteful synchronized ambient sound and a warm, confident ecommerce narration based on this script: ${script.slice(0,1600)}. Product: ${String(product.title||"")}. Creative direction: ${String(campaign.campaignAngle||campaign.subheadline||"")}. End with a natural visual product reveal suitable for the CTA: ${String(campaign.cta||"Shop now")}.`;
  const form=new FormData();form.append("model",process.env.OPENAI_VIDEO_MODEL||"sora-2");form.append("prompt",prompt);form.append("seconds","8");form.append("size","720x1280");const image=await referenceFile(imageUrl);form.append("input_reference",image,`reference.${image.type.includes("png")?"png":image.type.includes("webp")?"webp":"jpg"}`);
  const response=await fetch("https://api.openai.com/v1/videos",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form}),data=await response.json();if(!response.ok)return NextResponse.json({error:data.error?.message||"AI video generation could not start."},{status:response.status});return NextResponse.json({id:data.id,status:data.status,progress:data.progress||0})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"AI video generation failed."},{status:400})}
}
