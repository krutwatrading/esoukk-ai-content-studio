import{createHash}from"crypto";
import{NextResponse}from"next/server";
import{Resend}from"resend";
import{enforceRateLimit}from"@/lib/rate-limit";

export const runtime="nodejs";
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]||character);

export async function POST(){
 const access=await enforceRateLimit("email-test",5,3600);if(access.response)return access.response;
 const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL,webhookSecret=process.env.RESEND_WEBHOOK_SECRET;
 if(!apiKey||!from||!webhookSecret)return NextResponse.json({error:"Complete the Resend API key, sender address and webhook secret in Vercel first."},{status:503,headers:access.headers});
 if(!access.user.email)return NextResponse.json({error:"Your signed-in account does not have an email address."},{status:400,headers:access.headers});
 const resend=new Resend(apiKey),recipient=access.user.email,subject="KAVIA email delivery test",sentAt=new Date().toISOString();
 const result=await resend.emails.send({from,to:[recipient],subject,text:`Your eSoukk AI Commerce Studio email connection is working. Test created ${sentAt}.`,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px"><p style="letter-spacing:.12em;color:#9b772e;font-weight:700">KAVIA · ESOUKK AI</p><h1 style="font-family:Georgia,serif">Email delivery is connected</h1><p>This private configuration test was sent only to <strong>${escapeHtml(recipient)}</strong>.</p><p>Bulk campaign sending remains locked until domain and webhook validation are complete.</p><p style="color:#777;font-size:12px">Test created ${escapeHtml(sentAt)}</p></div>`,tags:[{name:"organization_id",value:access.organizationId},{name:"message_type",value:"configuration_test"}]},{idempotencyKey:`email-test/${access.user.id}/${createHash("sha256").update(sentAt.slice(0,13)).digest("hex").slice(0,20)}`});
 if(result.error)return NextResponse.json({error:result.error.message},{status:result.error.statusCode||502,headers:access.headers});
 return NextResponse.json({ok:true,id:result.data.id,recipient},{headers:access.headers});
}
