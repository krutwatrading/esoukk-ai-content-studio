import{createHash}from"crypto";
import{NextResponse}from"next/server";
import{Resend}from"resend";
import{enforceRateLimit}from"@/lib/rate-limit";
import{emailBrandConfig,parseEmailBrand}from"@/lib/email-brands";

export const runtime="nodejs";
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]||character);

const allowedHosts=()=>new Set(["shopkavia.com","www.shopkavia.com","esoukk.ae","www.esoukk.ae",...(process.env.ALLOWED_SHOPIFY_DOMAINS||"").split(",")].map(value=>value.trim().toLowerCase()).filter(Boolean));
const clean=(value:unknown,max:number)=>String(value||"").trim().slice(0,max);
const validCta=(value:unknown)=>{if(!value)return"";try{const url=new URL(String(value));return url.protocol==="https:"&&allowedHosts().has(url.hostname.toLowerCase())?url.toString():""}catch{return""}};

export async function POST(request:Request){
 const access=await enforceRateLimit("email-test",5,3600);if(access.response)return access.response;
 const apiKey=process.env.RESEND_API_KEY,webhookSecret=process.env.RESEND_WEBHOOK_SECRET;
 if(!apiKey||!webhookSecret)return NextResponse.json({error:"Complete the Resend API key and webhook secret in Vercel first."},{status:503,headers:access.headers});
 if(!access.user.email)return NextResponse.json({error:"Your signed-in account does not have an email address."},{status:400,headers:access.headers});
 const input=await request.json().catch(()=>({})) as Record<string,unknown>,brand=parseEmailBrand(input.brand),brandConfig=emailBrandConfig(brand),from=brandConfig.sender,ctaUrl=validCta(input.ctaUrl),campaignTest=Boolean(ctaUrl&&input.subject&&input.body);
 if(!from)return NextResponse.json({error:`Configure the ${brandConfig.label} sender address in Vercel before testing.`},{status:503,headers:access.headers});
 if(input.ctaUrl&&!ctaUrl)return NextResponse.json({error:"The email CTA must use an approved HTTPS storefront domain."},{status:400,headers:access.headers});
 const recipient=access.user.email,sentAt=new Date().toISOString(),subject=campaignTest?clean(input.subject,150):`${brandConfig.label} email delivery test`,preview=clean(input.preview,220),body=campaignTest?clean(input.body,5000):"Your eSoukk AI Commerce Studio email connection is working.",ctaLabel=clean(input.ctaLabel,50)||"Shop now",productTitle=clean(input.productTitle,180),imageUrl=validCta(input.imageUrl),escapedBody=escapeHtml(body).replace(/\r?\n/g,"<br/>");
 const html=`<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div><div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#181818"><p style="letter-spacing:.12em;color:#9b772e;font-weight:700">${escapeHtml(brandConfig.label)}</p>${imageUrl?`<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(productTitle)}" style="display:block;width:100%;max-height:520px;object-fit:contain;border-radius:16px;background:#f6f3ed"/>`:""}<h1 style="font-family:Georgia,serif">${escapeHtml(productTitle|| (campaignTest?subject:"Email delivery is connected"))}</h1><p style="font-size:16px;line-height:1.65">${escapedBody}</p>${ctaUrl?`<p style="margin:28px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${brandConfig.accent};color:#fff;text-decoration:none;font-weight:700">${escapeHtml(ctaLabel)}</a></p><p style="font-size:11px;color:#777">If the button does not open, visit: <a href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaUrl)}</a></p>`:""}<hr style="border:0;border-top:1px solid #ddd;margin:30px 0"/><p style="color:#777;font-size:11px">Private ${escapeHtml(brandConfig.label)} test sent only to ${escapeHtml(recipient)} · ${escapeHtml(sentAt)}</p></div>`;
 const textBody=`${productTitle?`${productTitle}\n\n`:""}${body}${ctaUrl?`\n\n${ctaLabel}: ${ctaUrl}`:""}\n\nPrivate test sent only to ${recipient}.`;
 const resend=new Resend(apiKey),messageType=campaignTest?"campaign_test":"configuration_test";
 const result=await resend.emails.send({from,to:[recipient],subject,text:textBody,html,replyTo:brandConfig.replyTo||undefined,tags:[{name:"organization_id",value:access.organizationId},{name:"message_type",value:messageType},{name:"brand",value:brand}]},{idempotencyKey:`email-test/${access.user.id}/${createHash("sha256").update(`${sentAt.slice(0,13)}:${brand}:${subject}:${ctaUrl}`).digest("hex").slice(0,20)}`});
 if(result.error)return NextResponse.json({error:result.error.message},{status:result.error.statusCode||502,headers:access.headers});
 return NextResponse.json({ok:true,id:result.data.id,recipient,campaignTest,brand,replyToConfigured:Boolean(brandConfig.replyTo)},{headers:access.headers});
}
