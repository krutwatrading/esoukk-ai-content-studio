"use client";

import { MessageCircle, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Contact={id:string;phone_e164:string;display_name:string|null;marketing_opt_in:boolean;opted_out_at:string|null};

export default function WhatsAppAudienceManager({compact=false,onCountChange}:{compact?:boolean;onCountChange?:(count:number)=>void}){
  const[contacts,setContacts]=useState<Contact[]>([]),[name,setName]=useState(""),[phone,setPhone]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
  const load=useCallback(async()=>{try{const response=await fetch("/api/whatsapp/contacts",{cache:"no-store"}),data=await response.json();if(!response.ok)throw new Error(data.error);setContacts(data.contacts||[]);onCountChange?.(Number(data.optedIn||0))}catch(error){setMessage(error instanceof Error?error.message:"Unable to load WhatsApp audience.")}},[onCountChange]);
  useEffect(()=>{void load()},[load]);
  async function add(){
    setBusy("add");setMessage("");
    try{const response=await fetch("/api/whatsapp/contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,displayName:name,marketingOptInConfirmed:confirmed})}),data=await response.json();if(!response.ok)throw new Error(data.error);setName("");setPhone("");setConfirmed(false);setMessage("Contact added with explicit WhatsApp marketing consent recorded.");await load()}catch(error){setMessage(error instanceof Error?error.message:"Unable to add contact.")}finally{setBusy("")}
  }
  async function toggle(contact:Contact,enabled:boolean){
    if(enabled&&!window.confirm(`Confirm that ${contact.display_name||contact.phone_e164} explicitly agreed to receive WhatsApp marketing messages from eSoukk.`))return;
    setBusy(contact.id);setMessage("");
    try{const response=await fetch("/api/whatsapp/contacts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:contact.id,marketingOptIn:enabled,marketingOptInConfirmed:enabled})}),data=await response.json();if(!response.ok)throw new Error(data.error);await load()}catch(error){setMessage(error instanceof Error?error.message:"Unable to update consent.")}finally{setBusy("")}
  }
  async function remove(contact:Contact){
    if(!window.confirm(`Remove ${contact.display_name||contact.phone_e164} from the WhatsApp audience?`))return;
    setBusy(contact.id);try{const response=await fetch(`/api/whatsapp/contacts?id=${encodeURIComponent(contact.id)}`,{method:"DELETE"}),data=await response.json();if(!response.ok)throw new Error(data.error);await load()}catch(error){setMessage(error instanceof Error?error.message:"Unable to remove contact.")}finally{setBusy("")}
  }
  const optedIn=contacts.filter(contact=>contact.marketing_opt_in&&!contact.opted_out_at).length;
  return <section className={`whatsapp-audience ${compact?"compact":""}`}>
    <div className="whatsapp-audience-heading"><div><span>WHATSAPP AUDIENCE</span><h4><MessageCircle size={17}/> Marketing opt-in contacts</h4></div><strong>{optedIn} eligible</strong></div>
    <div className="whatsapp-contact-form">
      <input value={name} onChange={event=>setName(event.target.value)} placeholder="Contact name"/>
      <input value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+971501234567"/>
      <label className="consent-check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>I confirm this contact explicitly agreed to receive WhatsApp marketing messages from eSoukk.</span></label>
      <button type="button" onClick={add} disabled={busy==="add"||!phone.trim()||!confirmed}><Plus size={15}/>{busy==="add"?"Adding…":"Add opted-in contact"}</button>
    </div>
    {!!contacts.length&&<div className="whatsapp-contact-list">{contacts.map(contact=><div key={contact.id}>
      <span><b>{contact.display_name||"WhatsApp contact"}</b><small>{contact.phone_e164}</small></span>
      <label className="contact-optin"><input type="checkbox" checked={contact.marketing_opt_in&&!contact.opted_out_at} disabled={busy===contact.id} onChange={event=>toggle(contact,event.target.checked)}/><span>Marketing opt-in</span></label>
      <button type="button" className="contact-remove" onClick={()=>remove(contact)} disabled={busy===contact.id} aria-label={`Remove ${contact.display_name||contact.phone_e164}`}><Trash2 size={15}/></button>
    </div>)}</div>}
    {!contacts.length&&<p className="whatsapp-audience-empty">No contacts recorded yet. Add only people who have explicitly opted in.</p>}
    {message&&<p className="whatsapp-audience-message">{message}</p>}
  </section>;
}
