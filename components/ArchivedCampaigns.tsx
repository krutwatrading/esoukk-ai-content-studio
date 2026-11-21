"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, RotateCcw } from "lucide-react";

type ArchivedItem={
  id:string;
  name:string;
  status:string;
  created_at:string;
  published_at:string|null;
  external_post_url:string|null;
  product_snapshot:{title?:string};
  settings:{image_url?:string;platform?:string;archived_at?:string;archived_from_status?:string};
  variation:{platform:string;content:{title?:string;caption?:string;description?:string;body?:string;image_url?:string}}|null;
};

export default function ArchivedCampaigns(){
  const[items,setItems]=useState<ArchivedItem[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
  const load=useCallback(async()=>{setLoading(true);setMessage("");try{const response=await fetch("/api/meta/campaigns?view=archived",{cache:"no-store"}),data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load archived campaigns.");setItems(data.campaigns||[])}catch(error){setMessage(error instanceof Error?error.message:"Unable to load archived campaigns.")}finally{setLoading(false)}},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);
  async function restore(item:ArchivedItem){setBusy(item.id);setMessage("");try{const response=await fetch("/api/meta/campaigns",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"restore",campaignId:item.id})}),data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to restore campaign.");setMessage(`“${title(item)}” restored to the review queue.`);await load()}catch(error){setMessage(error instanceof Error?error.message:"Unable to restore campaign.")}finally{setBusy("")}}
  return <main className="archive-page"><section className="panel archive-library"><div className="archive-library-heading"><div><div className="eyebrow">CAMPAIGN LIBRARY</div><h1>Archived campaigns</h1><p>Review campaigns kept outside the dashboard and restore them safely when needed.</p></div><div className="archive-library-actions"><a className="ui-action" href="/"><ArrowLeft size={16}/>Back to dashboard</a><button type="button" className="ui-action" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{loading?"Loading…":"Refresh"}</button></div></div>{message&&<div className="status">{message}</div>}{!loading&&!items.length&&<div className="queue-empty">No archived campaigns.</div>}<div className="archive-library-list">{items.map(item=><ArchiveCard key={item.id} item={item} working={busy===item.id} restore={restore}/>)}</div></section></main>;
}

function title(item:ArchivedItem){return item.variation?.content.title||item.product_snapshot?.title||item.name}

function ArchiveCard({item,working,restore}:{item:ArchivedItem;working:boolean;restore:(item:ArchivedItem)=>void}){
  const image=item.variation?.content.image_url||item.settings?.image_url,platform=item.settings?.platform||item.variation?.platform||"campaign",archivedAt=item.settings?.archived_at||item.created_at,copy=item.variation?.content.description||item.variation?.content.caption||item.variation?.content.body||"";
  return <article className="archive-library-card"><div className="archive-library-media">{image?<img src={image} alt={title(item)}/>:<div>No image</div>}</div><div className="archive-library-body"><div className="queue-platform">{platform} · archived</div><h2>{title(item)}</h2><p className="archive-meta">Archived {new Date(archivedAt).toLocaleString("en-AE",{timeZone:"Asia/Dubai"})} UAE · Previous status: {(item.settings?.archived_from_status||"unknown").replaceAll("_"," ")}</p>{copy&&<p className="archive-copy">{copy}</p>}<div className="review-actions">{item.external_post_url&&<a href={item.external_post_url} target="_blank" rel="noreferrer">View published post <ExternalLink size={14}/></a>}<button type="button" className="approve" onClick={()=>restore(item)} disabled={working}><RotateCcw size={15}/>{working?"Working…":"Restore"}</button></div></div></article>;
}
