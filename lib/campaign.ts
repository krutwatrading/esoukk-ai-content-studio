import OpenAI from "openai";
import { brand } from "./brand";
import type { CampaignCopy, CampaignRequest } from "./types";

const fallback = (r: CampaignRequest): CampaignCopy => {
  const name=r.product.title, offer=r.offer?.trim(), store=r.brandProfile?.storeName||brand.storeName;
  const igTags=["#eSoukk","#UAEFashion","#WomensFashion","#NewArrival","#DubaiStyle","#ShopUAE"];
  if(r.language==="Arabic")return {campaignAngle:"إطلالة عصرية للحياة اليومية في الإمارات",headline:name,subheadline:offer||"إضافة أنيقة لإطلالتك اليومية.",cta:"تسوقي الآن",instagramCaption:`اكتشفي ${name} ✨\n\nاختيار جديد لإطلالة أنيقة تناسب لحظاتك اليومية.${offer?`\n\n${offer}`:""}\n\nتسوقي الآن عبر ${store}.`,instagramHashtags:["#إيسوق","#أزياء_الإمارات","#أناقة","#دبي"],facebookCaption:`وصل حديثاً إلى ${store}: ${name}. اكتشفي تفاصيل المنتج والخيارات المتاحة والسعر الحالي عبر متجرنا الإلكتروني.`,facebookHashtags:["#تسوق_الإمارات","#إيسوق"],storyFrames:[`وصل حديثاً\n${name}`,"أناقة لكل يوم\nاكتشفي التفاصيل",`${offer||"متوفر الآن"}\nتسوقي الآن`],pinterestTitle:`${name} | أفكار أناقة في الإمارات`,pinterestDescription:`احفظي هذه الإطلالة واكتشفي ${name} من ${store}. شاهدي التفاصيل والخيارات المتاحة عبر الإنترنت.`,pinterestHashtags:["#أناقة","#أزياء_الإمارات"],xPost:`وصل حديثاً: ${name}. اكتشفيه الآن عبر ${store} ← ${r.product.url}`,linkedinPost:`إطلاق منتج ناجح في التجارة الإلكترونية يبدأ برسالة واضحة وتجربة متسقة. أحدث إضافاتنا ${name} متاحة الآن عبر ${store}.`,tiktokCaption:`لما تلاقين القطعة اللي تكمل إطلالتك ✨ ${name} متوفر الآن.`,tiktokHashtags:["#فاشن_تيك_توك","#أزياء_الإمارات","#دبي","#إيسوق"],reelHook:"قطعتك الجديدة المفضلة وصلت.",reelScript:["ابدئي بلقطة سريعة للمنتج.","اعرضي التفاصيل المتاحة من دون ادعاءات غير موثقة.","اعرضي إطلالة كاملة.","اختمي باسم المنتج ودعوة للتسوق."],emailSubject:`جديد ${store}: ${name}`,emailPreview:"اكتشفي أحدث إضافاتنا المختارة.",emailBody:`نقدم لكِ ${name}\n\nاكتشفي تفاصيل المنتج والخيارات المتاحة والسعر الحالي عبر متجرنا.${offer?`\n\n${offer}`:""}\n\nتسوقي الآن ←`,hashtags:["#إيسوق","#أزياء_الإمارات"],seoTitle:`${name} | أزياء نسائية في الإمارات | ${store}`,metaDescription:`تسوقي ${name} عبر الإنترنت في الإمارات من ${store}. شاهدي التفاصيل والخيارات المتاحة والأسعار الحالية.`,complianceNotes:["تم استخدام النص الاحتياطي لعدم إعداد مفتاح OpenAI.","راجعي جميع ادعاءات المنتج والعروض قبل النشر."]};
  return {
    campaignAngle:"One product, styled for modern UAE life", headline:name, subheadline:offer||"A refined addition to your everyday edit.", cta:r.brandProfile?.approvedCtas?.[0]||"SHOP NOW",
    instagramCaption:`A new favourite has entered the edit. ✨\n\nMeet ${name}—chosen for effortless styling from weekday plans to weekend moments.${offer?`\n\n${offer}`:""}\n\nTap the link in bio to discover it at ${store}.`, instagramHashtags:igTags,
    facebookCaption:`Looking for an easy way to refresh your wardrobe? Meet ${name}. Explore the details, available options and current price on ${store}.${offer?` ${offer}`:""}\n\nShop online today.`, facebookHashtags:["#eSoukkUAE","#ShopOnlineUAE"],
    storyFrames:[`NEW IN\n${name}`,"YOUR NEXT STYLE DISCOVERY\nSEE THE DETAILS",`${offer||"AVAILABLE NOW"}\nSHOP NOW`],
    pinterestTitle:`${name} | UAE Style Inspiration`, pinterestDescription:`Save this style idea for later. Discover ${name} from ${store}, selected for a polished modern wardrobe. View product details and available options online.`, pinterestHashtags:["#UAEStyle","#WomensStyle","#FashionInspiration"],
    xPost:`Just landed: ${name}. A polished new addition to the ${store} edit.${offer?` ${offer}`:""} Explore it now → ${r.product.url}`,
    linkedinPost:`What makes an ecommerce product launch effective? Clear positioning, consistent presentation and copy tailored to where customers discover it.\n\nOur latest edit, ${name}, is now live at ${store}.`,
    tiktokCaption:`POV: you found the piece that makes getting dressed easier ✨ ${name} is now live.${offer?` ${offer}`:""}`, tiktokHashtags:["#FashionTok","#UAEFashion","#DubaiStyle","#eSoukkFinds"],
    whatsappTemplateName:`esoukk_${r.goal}_${r.product.handle}`.toLowerCase().replace(/[^a-z0-9_]/g,"_").slice(0,60),whatsappHeader:name,whatsappBody:`Hi {{1}}, discover ${name} at ${store}.${offer?` ${offer}.`:""} Tap below to view the product.`,whatsappCta:"VIEW PRODUCT",whatsappOptInNote:"Send only to contacts with explicit WhatsApp marketing opt-in. Include and honour an opt-out method.",
    reelHook:"POV: your wardrobe just found its newest favourite.", reelScript:["Hook: fast product reveal with the product name on screen.","Show two close-up product details without unsupported claims.","Show a complete styling moment and available options.","End card: product name, offer if supplied, and SHOP NOW."],
    emailSubject:`New at ${store}: ${name}`, emailPreview:"Meet the latest addition to our curated edit.", emailBody:`Introducing ${name}\n\nA fresh style discovery is waiting. Explore the product details, available variants and current price online.${offer?`\n\n${offer}`:""}\n\nShop the new arrival →`,
    hashtags:igTags, seoTitle:`${name} | Women's Fashion UAE | ${store}`, metaDescription:`Shop ${name} online in the UAE at ${store}. View product details, available options and current pricing.`,
    complianceNotes:["Fallback copy used because OPENAI_API_KEY is not configured.","Each platform uses a different hook, structure, length and hashtag strategy.","Verify product and promotional claims before publishing."]
  };
};

export async function generateCampaign(r:CampaignRequest):Promise<CampaignCopy>{
  const base=fallback(r);
  if(!process.env.OPENAI_API_KEY)return base;
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const response=await client.responses.create({model:process.env.OPENAI_TEXT_MODEL||"gpt-5-mini",input:`You are the senior social commerce strategist for a UAE ecommerce brand. Create one coordinated campaign, but write genuinely distinct native copy for every platform. Do not reuse the same opening sentence, paragraph structure, CTA, or hashtag block across platforms.

Platform rules:
- Instagram: aspirational visual storytelling, short paragraphs, tasteful emojis, 5-8 discovery hashtags.
- Facebook: benefit-led and conversational, more context, direct link-friendly CTA, 1-3 hashtags.
- Instagram Story: exactly 3 concise frames, each suitable for on-image text, final frame has CTA.
- Pinterest: search-led evergreen title and description, keyword-rich but natural, 2-4 hashtags.
- X: concise, punchy, maximum 260 characters including the product URL, at most 2 hashtags.
- LinkedIn: professional ecommerce/lifestyle angle; no hashtags unless genuinely relevant. Do not force a consumer sales pitch.
- TikTok: hook-led creator language, short caption, trend-aware without invented trends, 3-5 hashtags.
- Email: curiosity-driven subject, preview and a short product body with a clear CTA.
- WhatsApp: approval-ready template name, short media header, concise personalised body using {{1}} for first name, one website CTA and an opt-in/opt-out compliance note. No hashtags.

Language rule: ${r.language==="Arabic"?"Write every customer-facing field in natural modern Arabic. Use Arabic CTA text and RTL-friendly phrasing.":r.language==="Bilingual"?"Write concise English and Arabic versions in every customer-facing field, with English first and Arabic second. Do not merely transliterate.":"Write in natural English."}

Use only supplied product facts. Never invent fabric, origin, sustainability, medical, shaping, performance, delivery, discount, stock or warranty claims. Follow the saved brand profile. Return valid JSON only with these exact keys: campaignAngle, headline, subheadline, cta, instagramCaption, instagramHashtags, facebookCaption, facebookHashtags, storyFrames, pinterestTitle, pinterestDescription, pinterestHashtags, xPost, linkedinPost, tiktokCaption, tiktokHashtags, whatsappTemplateName, whatsappHeader, whatsappBody, whatsappCta, whatsappOptInNote, reelHook, reelScript, emailSubject, emailPreview, emailBody, seoTitle, metaDescription, complianceNotes.

Brand profile: ${JSON.stringify(r.brandProfile||{storeName:brand.storeName,voice:brand.voice})}
Campaign settings: ${JSON.stringify({goal:r.goal,language:r.language,style:r.style,offer:r.offer||null,audience:r.audience})}
Product: ${JSON.stringify(r.product)}`});
  const generated=JSON.parse(response.output_text) as Partial<CampaignCopy>;
  return {...base,...generated,hashtags:generated.instagramHashtags||base.instagramHashtags};
}
