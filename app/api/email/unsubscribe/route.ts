import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/email-unsubscribe";

export const runtime="nodejs";
const page=(title:string,body:string,form="")=>new NextResponse(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>${title}</title><body style="font-family:Arial,sans-serif;background:#f2ece4;color:#181818;padding:40px"><main style="max-width:560px;margin:auto;background:#fff;padding:36px;border-radius:20px"><h1>${title}</h1><p style="line-height:1.6">${body}</p>${form}</main></body></html>`,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});

export async function GET(request:NextRequest){
 const token=request.nextUrl.searchParams.get("token")||"";
 if(!verifyUnsubscribeToken(token))return page("Invalid unsubscribe link","This link is invalid or has expired.");
 return page("Stop marketing emails","Confirm that you no longer want to receive marketing emails from this brand.",`<form method="post"><input type="hidden" name="token" value="${token.replace(/["&<>]/g,"")}"><button style="border:0;border-radius:999px;padding:13px 20px;background:#181818;color:#fff;font-weight:700">Unsubscribe</button></form>`);
}

export async function POST(request:NextRequest){
 const contentType=request.headers.get("content-type")||"";let token=request.nextUrl.searchParams.get("token")||"";
 if(!token){if(contentType.includes("application/json")){const body=await request.json().catch(()=>({})) as{token?:unknown};token=String(body.token||"")}else{const form=await request.formData().catch(()=>null);token=String(form?.get("token")||"")}}
 const payload=verifyUnsubscribeToken(token);if(!payload)return NextResponse.json({error:"Invalid or expired unsubscribe token."},{status:400});
 const admin=createSupabaseAdminClient(),{error}=await admin.from("email_suppressions").upsert({organization_id:payload.organizationId,email_hash:payload.emailHash,reason:"recipient_unsubscribe",source:"signed_unsubscribe_link"},{onConflict:"organization_id,email_hash"});
 if(error)return NextResponse.json({error:"Unable to record the unsubscribe request."},{status:500});
 const acceptsHtml=(request.headers.get("accept")||"").includes("text/html")||contentType.includes("form");
 return acceptsHtml?page("You are unsubscribed","Your request has been recorded. You will not receive future marketing campaigns from this workspace."):NextResponse.json({unsubscribed:true});
}
