"use client";

import { MessageCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Contact = {
  id: string; phone_e164: string | null; email: string | null; display_name: string | null;
  marketing_opt_in: boolean; opted_out_at: string | null; opt_in_source: string | null;
  shopify_customer_id: string | null;
};

async function readApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (response.status >= 500 || text.trimStart().startsWith("An error")) {
      throw new Error("The Shopify synchronization did not finish before the server timeout. Please try again.");
    }
    throw new Error("The server returned an invalid response. Please refresh and try again.");
  }
}

export default function WhatsAppAudienceManager({ compact=false, onCountChange }: { compact?: boolean; onCountChange?: (count:number)=>void }) {
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [name,setName]=useState(""),[phone,setPhone]=useState(""),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(""),[message,setMessage]=useState("");
  const load=useCallback(async()=>{
    try {
      const response=await fetch("/api/whatsapp/contacts",{cache:"no-store"}),data=await readApiResponse(response);
      if(!response.ok) throw new Error(String(data.error||"Unable to load the contact library."));
      setContacts((data.contacts as Contact[])||[]); onCountChange?.(Number(data.optedIn||0));
    } catch(error) { setMessage(error instanceof Error?error.message:"Unable to load the contact library."); }
  },[onCountChange]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void load()},0);
    return ()=>window.clearTimeout(timer);
  },[load]);

  async function syncShopify(){
    setBusy("sync");setMessage("");
    try {
      const response=await fetch("/api/shopify/customers/sync",{method:"POST"}),data=await readApiResponse(response);
      if(!response.ok)throw new Error(String(data.error||"Unable to synchronize Shopify customers."));
      setMessage(String(data.message||"Shopify contacts synchronized."));await load();
    } catch(error){setMessage(error instanceof Error?error.message:"Unable to synchronize Shopify customers.")}
    finally{setBusy("")}
  }
  async function add(){
    setBusy("add");setMessage("");
    try {
      const response=await fetch("/api/whatsapp/contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,displayName:name,marketingOptInConfirmed:confirmed})}),data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setName("");setPhone("");setConfirmed(false);setMessage("Offline contact saved with explicit WhatsApp consent.");await load();
    } catch(error){setMessage(error instanceof Error?error.message:"Unable to add contact.")}
    finally{setBusy("")}
  }
  async function toggle(contact:Contact,enabled:boolean){
    const label=contact.display_name||contact.phone_e164||contact.email||"this contact";
    if(enabled&&!window.confirm(`Confirm that ${label} explicitly agreed to receive WhatsApp marketing messages from eSoukk.`))return;
    setBusy(contact.id);setMessage("");
    try {
      const response=await fetch("/api/whatsapp/contacts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:contact.id,marketingOptIn:enabled,marketingOptInConfirmed:enabled})}),data=await response.json();
      if(!response.ok)throw new Error(data.error);await load();
    } catch(error){setMessage(error instanceof Error?error.message:"Unable to update consent.")}
    finally{setBusy("")}
  }
  async function remove(contact:Contact){
    const label=contact.display_name||contact.phone_e164||contact.email||"this contact";
    if(!window.confirm(`Remove ${label} from the contact library?`))return;
    setBusy(contact.id);
    try {
      const response=await fetch(`/api/whatsapp/contacts?id=${encodeURIComponent(contact.id)}`,{method:"DELETE"}),data=await response.json();
      if(!response.ok)throw new Error(data.error);await load();
    } catch(error){setMessage(error instanceof Error?error.message:"Unable to remove contact.")}
    finally{setBusy("")}
  }
  const optedIn=contacts.filter(contact=>contact.marketing_opt_in&&!contact.opted_out_at).length;
  return <section className={`whatsapp-audience ${compact?"compact":""}`}>
    <div className="whatsapp-audience-heading">
      <div><span>SHOPIFY CONTACT LIBRARY</span><h4><MessageCircle size={17}/> Customer email, mobile and WhatsApp consent</h4></div>
      <div className="contact-library-actions"><strong>{contacts.length} contacts · {optedIn} WhatsApp eligible</strong><button type="button" className="shopify-contact-sync" onClick={syncShopify} disabled={busy==="sync"}><RefreshCw size={14}/>{busy==="sync"?"Synchronizing…":"Import / sync Shopify"}</button></div>
    </div>
    <p className="contact-library-note">Shopify customers synchronize here automatically. WhatsApp eligibility is enabled only after the customer accepts the dedicated Shopify WhatsApp checkbox.</p>
    <details className="manual-contact-entry">
      <summary>Add an offline opt-in manually</summary>
      <div className="whatsapp-contact-form">
        <input value={name} onChange={event=>setName(event.target.value)} placeholder="Contact name"/>
        <input value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+971501234567"/>
        <label className="consent-check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>I confirm this contact explicitly agreed to receive WhatsApp marketing messages from eSoukk.</span></label>
        <button type="button" onClick={add} disabled={busy==="add"||!phone.trim()||!confirmed}><Plus size={15}/>{busy==="add"?"Adding…":"Add opted-in contact"}</button>
      </div>
    </details>
    {!!contacts.length&&<div className="whatsapp-contact-list">{contacts.map(contact=><div key={contact.id}>
      <span><b>{contact.display_name||"Shopify contact"}</b><small>{[contact.phone_e164,contact.email].filter(Boolean).join(" · ")||"No mobile or email"}</small><em>{contact.shopify_customer_id?"Shopify synchronized":"Manually added"}{contact.opt_in_source==="shopify_storefront_checkbox"?" · Storefront WhatsApp opt-in":""}</em></span>
      <label className="contact-optin"><input type="checkbox" checked={contact.marketing_opt_in&&!contact.opted_out_at} disabled={busy===contact.id} onChange={event=>toggle(contact,event.target.checked)}/><span>Marketing opt-in</span></label>
      <button type="button" className="contact-remove" onClick={()=>remove(contact)} disabled={busy===contact.id} aria-label={`Remove ${contact.display_name||contact.phone_e164||contact.email}`}><Trash2 size={15}/></button>
    </div>)}</div>}
    {!contacts.length&&<p className="whatsapp-audience-empty">No Shopify contacts synchronized yet. Select “Import / sync Shopify” to import existing customers.</p>}
    {message&&<p className="whatsapp-audience-message">{message}</p>}
  </section>;
}
