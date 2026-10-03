"use client";

import {useEffect,useState,type ReactNode} from "react";
import {Facebook,Ghost,Images,Instagram,MessageCircle,Music2,Search,ShieldCheck,Unplug,Youtube} from "lucide-react";

type Channel={id:string;name:string;configured:boolean;connected:boolean;accountName:string|null;callbackUrl:string;keys:string[];expiresAt:string|null;expired:boolean};
type Status={channels:Channel[]};

const icons:Record<string,ReactNode>={instagram:<Instagram/>,facebook:<Facebook/>,tiktok:<Music2/>,google:<><Search/><Youtube/></>,snapchat:<Ghost/>,whatsapp:<MessageCircle/>,pinterest:<Images/>};
const connectPath:Record<string,string>={instagram:"/api/meta/connect",facebook:"/api/facebook/connect",tiktok:"/api/tiktok/connect",whatsapp:"/api/whatsapp/connect",pinterest:"/api/pinterest/connect"};

function setupNote(channelId:string){
  if(channelId==="tiktok")return "Login Kit uses user.info.basic while Production review is pending.";
  if(channelId==="facebook")return "Enable Facebook Login for Business with pages_show_list, pages_read_engagement and pages_manage_posts.";
  if(channelId==="whatsapp")return "Use a permanent system-user token. Marketing sends are restricted to opted-in contacts and approved WhatsApp templates.";
  if(channelId==="pinterest")return "Pinterest requires an approved developer app, a business account and a public board ID for Pin publishing.";
  return "The official OAuth and publishing endpoint will be activated after credentials are supplied.";
}

export default function MetaPublishingPanel(){
  const[data,setData]=useState<Status|null>(null),[expanded,setExpanded]=useState<string|null>(null),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
  async function load(){try{const response=await fetch("/api/meta/status",{cache:"no-store"}),payload=await response.json();setData({channels:Array.isArray(payload?.channels)?payload.channels:[]})}catch{setData({channels:[]})}}
  useEffect(()=>{const timer=window.setTimeout(()=>{void load()},0);return()=>window.clearTimeout(timer)},[]);
  async function disconnect(channel:Channel){if(!window.confirm(`Disconnect ${channel.name} and remove its stored publishing token?`))return;setBusy(channel.id);setMessage("");try{const response=await fetch(`/api/meta/connections?provider=${encodeURIComponent(channel.id)}`,{method:"DELETE"}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"Connection could not be removed.");setMessage(`${channel.name} disconnected. Its stored token was removed.`);await load()}catch(error){setMessage(error instanceof Error?error.message:"Connection could not be removed.")}finally{setBusy("")}}
  function openQueue(){document.getElementById("content-review-queue")?.scrollIntoView({behavior:"smooth",block:"start"})}
  const channels=Array.isArray(data?.channels)?data.channels:[];
  return <section className="panel meta-panel channel-hub" id="meta-publishing">
    <div className="meta-heading"><div><div className="eyebrow">PHASE 4 · OMNICHANNEL PUBLISHING</div><h2>Connect, approve and publish everywhere</h2><p>One approval-first control centre for Instagram, Facebook, TikTok, WhatsApp, Google/YouTube and Snapchat.</p></div><span className="readiness ready"><ShieldCheck size={16}/>{channels.filter(item=>item.connected).length} connected</span></div>
    <div className="channel-grid">{channels.map(channel=><article key={channel.id} className={`channel-card ${channel.connected?"connected":channel.configured?"configured":"setup"}`}>
      <header><div className="channel-icon">{icons[channel.id]}</div><span className="channel-state">{channel.expired?"Token expired":channel.connected?"Connected":channel.configured?"Credentials ready":"Setup required"}</span></header>
      <h3>{channel.name}</h3>
      <p>{channel.connected?`@${channel.accountName||"Business account"}${channel.expiresAt?` · token ${channel.expired?"expired":"expires"} ${new Date(channel.expiresAt).toLocaleDateString("en-AE")}`:""}`:channel.configured?"Authorize the business account to activate publishing.":"Add official developer credentials in Vercel before authorization."}</p>
      <div className="channel-actions">{connectPath[channel.id]&&channel.configured?<a href={connectPath[channel.id]}>{channel.connected?"Reconnect":"Connect"}</a>:channel.connected?<button type="button" onClick={openQueue}>Open Queue</button>:<button type="button" onClick={()=>setExpanded(expanded===channel.id?null:channel.id)}>{expanded===channel.id?"Hide setup":"Setup details"}</button>}{channel.connected&&<button type="button" className="disconnect-channel" onClick={()=>disconnect(channel)} disabled={busy===channel.id}>{busy===channel.id?"Disconnecting…":"Disconnect"}</button>}</div>
      {expanded===channel.id&&<div className="channel-setup"><strong>Vercel environment variables</strong>{channel.keys.map(key=><code key={key}>{key}</code>)}<strong>OAuth callback</strong><code>{channel.callbackUrl}</code><small>{setupNote(channel.id)}</small></div>}
    </article>)}</div>
    {data&&!channels.length&&<div className="status error">Channel status is temporarily unavailable. Refresh after deployment completes.</div>}
    {message&&<div className="status">{message}</div>}
    <div className="channel-policy"><Unplug size={18}/><div><strong>Approval-first across every channel</strong><p>Setup channels remain visible for planning, but cannot publish until their credentials, OAuth authorization and platform review are complete.</p></div><button type="button" className="ui-action" onClick={openQueue}>Open Review Queue</button></div>
  </section>
}
