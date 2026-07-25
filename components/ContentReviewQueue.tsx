"use client";
import { useCallback, useEffect, useState } from "react";
import WhatsAppAudienceManager from "./WhatsAppAudienceManager";
import { Archive, CalendarClock, CheckCircle2, ExternalLink, RefreshCw, Send, Trash2, XCircle } from "lucide-react";

type Item={id:string;name:string;status:string;scheduled_for:string|null;published_at:string|null;publishing_error:string|null;external_post_url:string|null;publish_attempts:number;product_snapshot:{title?:string};settings:{image_url?:string;platform?:string};variation:{id:string;platform:string;content:{caption?:string;body?:string;image_url?:string;template_name?:string;cta_label?:string;product_url?:string}}|null};

export default function ContentReviewQueue(){
  const[items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
  const load=useCallback(async()=>{try{const response=await fetch("/api/meta/campaigns",{cache:"no-store"}),data=await response.json();if(!response.ok)throw new Error(data.error);setItems(data.campaigns||[])}catch(error){setMessage(error instanceof Error?error.message:"Unable to load review queue.")}finally{setLoading(false)}},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void load()},0);return()=>window.clearTimeout(timer)},[load]);
  async function action(item:Item,actionName:string,extra={}){if(!item.variation&&actionName!=="archive")return;setBusy(`${item.id}:${actionName}`);setMessage("");try{const response=await fetch("/api/meta/campaigns",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:actionName,campaignId:item.id,variationId:item.variation?.id||"",...extra})}),data=await response.json();if(!response.ok)throw new Error(data.error);await load()}catch(error){setMessage(error instanceof Error?error.message:"Review action failed.")}finally{setBusy("")}}
  async function remove(item:Item){if(!window.confirm(`Permanently delete “${item.product_snapshot?.title||item.name}” and its local campaign data? Published social posts will remain live.`))return;setBusy(`${item.id}:delete`);setMessage("");try{const response=await fetch(`/api/meta/campaigns?campaignId=${encodeURIComponent(item.id)}`,{method:"DELETE"}),data=await response.json();if(!response.ok)throw new Error(data.error);await load()}catch(error){setMessage(error instanceof Error?error.message:"Campaign deletion failed.")}finally{setBusy("")}}
  async function publish(item:Item){setBusy(`${item.id}:publish`);setMessage("");try{const response=await fetch(`/api/meta/publish-due?campaignId=${encodeURIComponent(item.id)}`,{method:"POST"}),data=await response.json();if(!response.ok)throw new Error(data.error);const result=data.results?.[0],label=item.settings.platform==="whatsapp"?"WhatsApp campaign":"Instagram post";setMessage(result?.status==="published"?`${label} published successfully.`:result?.error||"This campaign is not due yet.");await load()}catch(error){setMessage(error instanceof Error?error.message:"Publishing failed.")}finally{setBusy("")}}
  function refresh(){setLoading(true);void load()}
  return <section className="panel review-queue" id="content-review-queue">
    <div className="queue-heading"><div><div className="eyebrow">CONTENT REVIEW QUEUE</div><h2>Preview, approve and publish</h2><p>Archive old campaigns or permanently delete failed and unwanted campaigns.</p></div><button type="button" className="ui-action queue-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16}/>{loading?"Loading…":"Refresh"}</button></div>
    {message&&<div className="status">{message}</div>}
    {!loading&&!items.length&&<div className="queue-empty">No active campaigns. Archived campaigns stay hidden.</div>}
    <div className="queue-list">{items.map(item=><ReviewCard key={item.id} item={item} busy={busy} action={action} publish={publish} remove={remove}/>)}</div>
  </section>
}

function ReviewCard({item,busy,action,publish,remove}:{item:Item;busy:string;action:(item:Item,name:string,extra?:Record<string,string>)=>void;publish:(item:Item)=>void;remove:(item:Item)=>void}){
  const platform=item.settings.platform==="whatsapp"?"whatsapp":"instagram";
  const[content,setContent]=useState(item.variation?.content.caption||item.variation?.content.body||""),[date,setDate]=useState("");
  const[consentConfirmed,setConsentConfirmed]=useState(false),[optedIn,setOptedIn]=useState(0);
  const working=busy.startsWith(item.id),image=item.variation?.content.image_url||item.settings?.image_url;
  const safeWhatsAppRetry=platform==="whatsapp"&&Boolean(item.publishing_error?.includes("whatsapp_contacts"));
  return <article className="review-card">
    <div className="review-media">{image?<img src={image} alt={item.product_snapshot?.title||item.name}/>:<div>No image</div>}<span className={`queue-status ${item.status}`}>{item.status.replaceAll("_"," ")}</span></div>
    <div className="review-body"><div className="queue-platform">{platform==="whatsapp"?"WhatsApp template":"Instagram post"}</div><h3>{item.product_snapshot?.title||item.name}</h3>
      {platform==="whatsapp"&&item.variation?.content.template_name&&<small>Template: {item.variation.content.template_name}</small>}
      <textarea value={content} onChange={event=>setContent(event.target.value)} disabled={item.status==="published"||working}/>
      {item.publishing_error&&<p className="queue-error">{item.publishing_error}</p>}
      {platform==="whatsapp"&&<details className="queue-whatsapp-audience" open={safeWhatsAppRetry}><summary>Manage opted-in WhatsApp audience ({optedIn} eligible)</summary><WhatsAppAudienceManager compact onCountChange={setOptedIn}/></details>}
      {item.scheduled_for&&<p className="queue-time"><CalendarClock size={14}/> {new Date(item.scheduled_for).toLocaleString("en-AE",{timeZone:"Asia/Dubai"})} UAE</p>}
      <div className="review-actions">
        {item.status!=="published"&&<button type="button" onClick={()=>action(item,"update_caption",{caption:content})} disabled={working}><RefreshCw size={15}/>Save changes</button>}
        {["ready_for_review","changes_requested"].includes(item.status)&&<button type="button" className="approve" onClick={()=>action(item,"approve")} disabled={working}><CheckCircle2 size={15}/>Approve</button>}
        {["ready_for_review","approved","changes_requested"].includes(item.status)&&<button type="button" className="reject" onClick={()=>action(item,"reject")} disabled={working}><XCircle size={15}/>Reject</button>}
        {item.status==="approved"&&<><input type="datetime-local" value={date} onChange={event=>setDate(event.target.value)}/>{platform==="whatsapp"&&<label className="consent-check queue-consent"><input type="checkbox" checked={consentConfirmed} onChange={event=>setConsentConfirmed(event.target.checked)}/><span>Send only to opted-in contacts</span></label>}<button type="button" onClick={()=>action(item,"schedule",{scheduledFor:new Date(`${date}:00+04:00`).toISOString()})} disabled={working||!date||(platform==="whatsapp"&&(!consentConfirmed||!optedIn))}><CalendarClock size={15}/>Schedule</button></>}
        {item.status==="partially_failed"&&(platform==="instagram"||safeWhatsAppRetry)&&<button type="button" className="publish-selected" onClick={()=>action(item,"retry")} disabled={working}><RefreshCw size={15}/>{working?"Preparing…":safeWhatsAppRetry?"Retry after setup":"Retry publishing"}</button>}
        {item.status==="scheduled"&&<button type="button" className="publish-selected" onClick={()=>publish(item)} disabled={working}><Send size={15}/>{working?"Publishing…":platform==="whatsapp"?"Send WhatsApp campaign":"Publish selected post"}</button>}
        {item.external_post_url&&<a href={item.external_post_url} target="_blank" rel="noreferrer">View on Instagram <ExternalLink size={14}/></a>}
        <button type="button" className="archive-campaign" onClick={()=>action(item,"archive")} disabled={working}><Archive size={15}/>Archive</button>
        <button type="button" className="delete-campaign" onClick={()=>remove(item)} disabled={working}><Trash2 size={15}/>Delete</button>
      </div>
    </div>
  </article>
}
