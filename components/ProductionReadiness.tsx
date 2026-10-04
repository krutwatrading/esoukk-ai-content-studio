"use client";

import Link from "next/link";
import { useCallback,useEffect,useState } from "react";
import { Activity,RefreshCw,ShieldCheck,TriangleAlert } from "lucide-react";

type Health={status:"healthy"|"attention";checks:Record<string,boolean>;latencyMs:number;checkedAt:string};
const labels:Record<string,string>={database:"Database",shopify:"Shopify",generativeAi:"AI copy & images",video:"Runway video",tokenEncryption:"Token encryption",publishingWorker:"Publishing worker",legalPages:"Privacy & terms"};

export default function ProductionReadiness(){
 const[data,setData]=useState<Health|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(interactive=false)=>{if(interactive){setLoading(true);setError("")}try{const response=await fetch("/api/health",{cache:"no-store"}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"Health check failed.");setData(payload)}catch(reason){setError(reason instanceof Error?reason.message:"Health check failed.")}finally{setLoading(false)}},[]);
 useEffect(()=>{const timer=window.setTimeout(()=>{void load()},0);return()=>window.clearTimeout(timer)},[load]);
 const entries=Object.entries(data?.checks||{}),ready=entries.filter(([,value])=>value).length;
 return <section className="panel production-readiness" id="production-readiness"><div className="readiness-heading"><div><div className="eyebrow">PHASE 10 · PRODUCTION SAFETY &amp; RELIABILITY</div><h2><Activity size={24}/> Launch readiness</h2><p>Private operational checks confirm the services required for secure campaign generation and publishing.</p></div><span className={`readiness ${data?.status==="healthy"?"ready":"setup"}`}>{data?.status==="healthy"?<ShieldCheck size={16}/>:<TriangleAlert size={16}/>} {loading?"Checking…":`${ready}/${entries.length} ready`}</span></div><div className="health-check-grid">{entries.map(([key,value])=><span className={value?"healthy":"attention"} key={key}>{value?<ShieldCheck size={14}/>:<TriangleAlert size={14}/>} {labels[key]||key}</span>)}</div>{data&&<small>Last checked {new Date(data.checkedAt).toLocaleString("en-AE",{timeZone:"Asia/Dubai"})} UAE · {data.latencyMs} ms</small>}{error&&<div className="status error">{error}</div>}<div className="readiness-actions"><button type="button" onClick={()=>void load(true)} disabled={loading}><RefreshCw size={15} className={loading?"spin":""}/> Refresh checks</button><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></section>
}
