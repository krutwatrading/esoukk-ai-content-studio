"use client";

import { CalendarClock, CheckCircle2, ExternalLink, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { CampaignCopy, ProductData } from "@/lib/types";
import WhatsAppAudienceManager from "./WhatsAppAudienceManager";

type Draft={id:string;variationId:string};
type State="editing"|"saving"|"review"|"approving"|"approved"|"scheduling"|"scheduled";

export default function WhatsAppApprovalPanel({product,campaign,publishImage}:{product:ProductData;campaign:CampaignCopy;publishImage?:string}){
  const productUrl=typeof product.url==="string"?product.url:"";
  const generatedBody=typeof campaign.whatsappBody==="string"?campaign.whatsappBody:"";
  const initialBody=productUrl&&generatedBody.includes(productUrl)?generatedBody:`${generatedBody}${productUrl?`\n\nShop now: ${productUrl}`:""}`.trim();
  const[templateName,setTemplateName]=useState(campaign.whatsappTemplateName||"");
  const[language,setLanguage]=useState("en");
  const[body,setBody]=useState(initialBody);
  const[draft,setDraft]=useState<Draft|null>(null);
  const[scheduledFor,setScheduledFor]=useState("");
  const[state,setState]=useState<State>("editing");
  const[message,setMessage]=useState("");
  const[contacts,setContacts]=useState<number|null>(null);
  const[consentConfirmed,setConsentConfirmed]=useState(false);

  useEffect(()=>{fetch("/api/whatsapp/contacts",{cache:"no-store"}).then(response=>response.json()).then(data=>setContacts(Number(data.optedIn||0))).catch(()=>setContacts(null))},[]);

  async function call(method:"POST"|"PATCH",payload:unknown){
    const response=await fetch("/api/meta/campaigns",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),data=await response.json();
    if(!response.ok)throw new Error(data.error||"WhatsApp campaign action failed.");
    return data;
  }
  async function saveDraft(){
    setState("saving");setMessage("");
    try{
      let imageUrl=publishImage||product.images[0];
      if(publishImage?.startsWith("data:")){
        const response=await fetch("/api/meta/assets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dataUrl:publishImage})}),asset=await response.json();
        if(!response.ok)throw new Error(asset.error);imageUrl=asset.url;
      }
      const data=await call("POST",{platform:"whatsapp",product,imageUrl,templateName,templateLanguage:language,body,cta:"SHOP NOW",productUrl});
      setDraft({id:data.campaign.id,variationId:data.campaign.variationId});setState("review");
      setMessage("WhatsApp draft saved. Confirm that the template name exactly matches an approved Meta template.");
    }catch(error){setState("editing");setMessage(error instanceof Error?error.message:"Unable to save WhatsApp draft.")}
  }
  async function approve(){
    if(!draft)return;setState("approving");
    try{await call("PATCH",{action:"approve",campaignId:draft.id,variationId:draft.variationId});setState("approved");setMessage("Approved. Nothing has been sent yet.")}
    catch(error){setState("review");setMessage(error instanceof Error?error.message:"Unable to approve.")}
  }
  async function schedule(){
    if(!draft)return;setState("scheduling");
    try{
      const iso=new Date(`${scheduledFor}:00+04:00`).toISOString();
      await call("PATCH",{action:"schedule",campaignId:draft.id,variationId:draft.variationId,scheduledFor:iso});
      setState("scheduled");setMessage(`Scheduled for ${contacts??0} opted-in contact${contacts===1?"":"s"} at ${scheduledFor.replace("T"," ")} UAE time.`);
    }catch(error){setState("approved");setMessage(error instanceof Error?error.message:"Unable to schedule WhatsApp campaign.")}
  }

  const preview=publishImage||product.images[0];
  return <section className="publishing-approval whatsapp-approval">
    <div className="publishing-title"><div><span>WHATSAPP MARKETING APPROVAL</span><h3>Review the template campaign</h3><small>{publishImage?"Designed WhatsApp creative selected":"Select “Use for WhatsApp” under the WhatsApp creative"}</small></div><strong className={`publishing-state ${state}`}>{state==="review"?"READY FOR REVIEW":state.toUpperCase()}</strong></div>
    <div className="publishing-preview"><img src={preview} alt={product.title}/><div className="whatsapp-template-fields">
      <label>APPROVED META TEMPLATE NAME<input value={templateName} onChange={event=>setTemplateName(event.target.value)} disabled={state!=="editing"}/></label>
      <label>TEMPLATE LANGUAGE<input value={language} onChange={event=>setLanguage(event.target.value)} disabled={state!=="editing"}/></label>
      <label>MESSAGE PREVIEW<textarea value={body} onChange={event=>setBody(event.target.value)} disabled={state!=="editing"}/></label>
      <div className="whatsapp-cta-preview"><span>CALL TO ACTION</span><a href={productUrl} target="_blank" rel="noreferrer">SHOP NOW <ExternalLink size={14}/></a><small>{productUrl}</small></div>
      <small>{contacts===null?"Checking audience…":`${contacts} opted-in contact${contacts===1?"":"s"} available`}</small>
    </div></div>
    <div className="whatsapp-compliance"><strong>Consent required</strong><span>Only contacts recorded with explicit WhatsApp marketing opt-in will receive this approved template. Opted-out contacts are excluded automatically.</span></div>
    <WhatsAppAudienceManager onCountChange={setContacts}/>
    <div className="publishing-actions">
      {!draft&&<button type="button" onClick={saveDraft} disabled={state==="saving"||!templateName.trim()||!body.trim()||!publishImage}><Save size={16}/>{state==="saving"?"Saving…":"Save WhatsApp Draft"}</button>}
      {(state==="review"||state==="approving")&&<button type="button" className="approve" onClick={approve} disabled={state==="approving"}><CheckCircle2 size={16}/>{state==="approving"?"Approving…":"Approve WhatsApp Campaign"}</button>}
      {(state==="approved"||state==="scheduling")&&<><label>UAE DATE & TIME<input type="datetime-local" value={scheduledFor} onChange={event=>setScheduledFor(event.target.value)} disabled={state==="scheduling"}/></label><label className="consent-check campaign-consent"><input type="checkbox" checked={consentConfirmed} onChange={event=>setConsentConfirmed(event.target.checked)} disabled={state==="scheduling"}/><span>I confirm this campaign will be sent only to the opted-in contacts shown above.</span></label><button type="button" onClick={schedule} disabled={!scheduledFor||state==="scheduling"||!contacts||!consentConfirmed}><CalendarClock size={16}/>{state==="scheduling"?"Scheduling…":"Schedule WhatsApp"}</button></>}
      {state==="scheduled"&&<button type="button" className="action-complete" disabled><CheckCircle2 size={16}/>Scheduled</button>}
    </div>
    {message&&<p className="publishing-message">{message}</p>}
  </section>;
}
