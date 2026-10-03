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
  const image=await referenceFile(imageUrl),extension=image.type.includes("png")?"png":image.type.includes("webp")?"webp":"jpg";
  const submit=async()=>{const form=new FormData();form.append("model",process.env.OPENAI_VIDEO_MODEL||"sora-2");form.append("prompt",prompt);form.append("seconds","8");form.append("size","720x1280");form.append("input_reference",image,`reference.${extension}`);return fetch("https://api.openai.com/v1/videos",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form})};
  let response=await submit();if(response.status>=500)response=await submit();const raw=await response.text();let data:{id?:string;status?:string;progress?:number;error?:{message?:string}}={};if(raw){try{data=JSON.parse(raw)}catch{return NextResponse.json({error:`OpenAI video API returned unreadable data (HTTP ${response.status}). Please retry.`},{status:502})}}if(!response.ok)return NextResponse.json({error:data.error?.message||`OpenAI video API returned HTTP ${response.status}${raw?"":" with an empty response"}.`},{status:response.status>=500?502:response.status});if(!data.id)return NextResponse.json({error:"OpenAI accepted the request but did not return a video job ID. Please retry."},{status:502});return NextResponse.json({id:data.id,status:data.status,progress:data.progress||0})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"AI video generation failed."},{status:400})}
}
