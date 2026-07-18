"use client";
import { useMemo, useState } from "react";
import { Sparkles, ShoppingBag, WandSparkles } from "lucide-react";
import CreativeCanvas from "./CreativeCanvas";
import ShopifyProductPicker from "./ShopifyProductPicker";
import CreativeAgentStudio from "./CreativeAgentStudio";
import BrandProfilePanel from "./BrandProfilePanel";
import ShopifyAutomation from "./ShopifyAutomation";
import BrandLogo from "./BrandLogo";
import VisualConceptPicker from "./VisualConceptPicker";
import MetaPublishingPanel from "./MetaPublishingPanel";
import type { BrandProfile, CampaignCopy, ProductData, VisualStyle } from "@/lib/types";

export default function ContentStudio({initialBrandProfile}:{initialBrandProfile:BrandProfile}) {
  const [url,setUrl]=useState("https://esoukk.ae/products/madison-luxe-top-handle-handbag");
  const [product,setProduct]=useState<ProductData|null>(null),[campaign,setCampaign]=useState<CampaignCopy|null>(null);
  const [brandProfile,setBrandProfile]=useState(initialBrandProfile),[goal,setGoal]=useState("new-arrival"),[language,setLanguage]=useState("English"),[style,setStyle]=useState("luxury"),[offer,setOffer]=useState("");
  const [audience,setAudience]=useState(initialBrandProfile.audiences[0]||"Women in the UAE seeking premium, affordable fashion");
  const [status,setStatus]=useState(""),[error,setError]=useState(""),[tab,setTab]=useState("copy"),[background,setBackground]=useState<string>(),[loading,setLoading]=useState(false),[importing,setImporting]=useState(false),[imported,setImported]=useState(false),[copied,setCopied]=useState<string|null>(null);
  const price=useMemo(()=>product?`${product.currency} ${product.price.toFixed(2)}`:"",[product]);
  const post=async(path:string,body:unknown)=>{const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw new Error(data.error);return data};

  async function imp(){setImporting(true);setImported(false);setError("");setStatus("Importing Shopify product...");try{const data=await post("/api/import-product",{url});setProduct(data.product);setCampaign(null);setImported(true);setStatus(`Imported ${data.product.title}. Review settings, then generate.`);window.setTimeout(()=>setImported(false),2200);}catch(e){setError(e instanceof Error?e.message:"Import failed");}finally{setImporting(false)}}
  async function gen(){if(!product)return;setLoading(true);setError("");setStatus("Creating platform-specific campaign variations...");try{const data=await post("/api/generate-campaign",{product,goal,language,style,offer,audience,brandProfile});setCampaign(data.campaign);setStatus("Distinct Instagram, Facebook, Pinterest, X, LinkedIn, TikTok and email copy is ready.");}catch(e){setError(e instanceof Error?e.message:"Generation failed");}finally{setLoading(false)}}
  async function lifestyle(){if(!product)return;setLoading(true);setError("");try{const data=await post("/api/generate-lifestyle",{productTitle:product.title,style});setBackground(data.dataUrl);setStatus("Lifestyle background applied.");}catch(e){setError(e instanceof Error?e.message:"Image generation failed");}finally{setLoading(false)}}
  const cp=async(label:string,text:string)=>{await navigator.clipboard.writeText(text);setCopied(label);window.setTimeout(()=>setCopied(current=>current===label?null:current),1800);};
  const copyCards=campaign ? [
    ["Instagram",`${campaign.instagramCaption}\n\n${campaign.instagramHashtags.join(" ")}`],
    ["Facebook",`${campaign.facebookCaption}\n\n${campaign.facebookHashtags.join(" ")}`],
    ["Instagram Story",campaign.storyFrames.map((x,i)=>`Frame ${i+1}\n${x}`).join("\n\n")],
    ["Pinterest",`${campaign.pinterestTitle}\n\n${campaign.pinterestDescription}\n\n${campaign.pinterestHashtags.join(" ")}`],
    ["X (Twitter)",campaign.xPost],["LinkedIn",campaign.linkedinPost],
    ["TikTok",`${campaign.tiktokCaption}\n\n${campaign.tiktokHashtags.join(" ")}`],
    ["Email",`${campaign.emailSubject}\n${campaign.emailPreview}\n\n${campaign.emailBody}`]
  ] : [];

  return <div className="shell"><header className="topbar"><BrandLogo className="header-logo"/><div className="badge">eSoukk AI Content Studio · Approval Mode</div></header><main>
    <section className="hero"><h1>One product.<br/>A full campaign.</h1><p>Choose an eSoukk Shopify product. The agent applies your saved brand rules and writes native copy for each platform—not duplicated captions.</p></section>
    <BrandProfilePanel initial={brandProfile} onSaved={setBrandProfile}/>
    <ShopifyAutomation/>
    <MetaPublishingPanel/>
    <ShopifyProductPicker selectedHandle={product?.handle} onSelect={selected=>{setProduct(selected);setUrl(selected.url);setCampaign(null);setStatus(`Selected ${selected.title}. Campaign settings are ready below.`);setError("");window.setTimeout(()=>document.getElementById("campaign-settings")?.scrollIntoView({behavior:"smooth",block:"start"}),100);}}/>
    <CreativeAgentStudio product={product}/>
    <section className="panel form-panel" id="campaign-settings"><div className="field"><label>SHOPIFY PRODUCT LINK</label><input value={url} onChange={e=>{setUrl(e.target.value);setImported(false)}}/></div><div className="actions"><button type="button" className={`primary ${imported?"action-confirmed":""}`} onClick={imp} disabled={loading||importing} aria-busy={importing}><ShoppingBag size={17}/>{importing?"Importing…":imported?"Imported ✓":"Import Product"}</button></div>
      {product&&<><div className="grid grid-2 settings"><div className="field"><label>CAMPAIGN GOAL</label><select value={goal} onChange={e=>setGoal(e.target.value)}><option value="new-arrival">New arrival</option><option value="sales">Sales conversion</option><option value="awareness">Brand awareness</option><option value="engagement">Engagement</option></select></div><div className="field"><label>LANGUAGE</label><select value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Arabic</option><option>Bilingual</option></select></div><div className="field"><label>VISUAL STYLE</label><select value={style} onChange={e=>setStyle(e.target.value)}><option value="minimal-luxury">Minimal luxury</option><option value="editorial">Editorial</option><option value="resort">UAE resort</option><option value="performance">Performance</option></select></div><div className="field"><label>OFFER — OPTIONAL</label><input value={offer} onChange={e=>setOffer(e.target.value)} placeholder="10% OFF with code WELCOME10"/></div><div className="field full"><label>TARGET AUDIENCE</label><input value={audience} onChange={e=>setAudience(e.target.value)}/></div></div><div className="actions"><button type="button" className="secondary" onClick={gen} disabled={loading}><Sparkles size={17}/>{loading?" Working...":" Generate Full Campaign"}</button><button type="button" className="ghost" onClick={lifestyle} disabled={loading}><WandSparkles size={17}/> Generate Lifestyle Background</button></div></>}
      {product&&<VisualConceptPicker value={style as VisualStyle} onChange={setStyle}/>}
      {status&&<div className="status">{status}</div>}{error&&<div className="status error">{error}</div>}
    </section>
    {product&&<section className="workspace"><aside className="panel product-card">{product.images[0]&&<img src={product.images[0]} alt={product.title}/>}<h2>{product.title}</h2><div className="price">{price}</div><p>{product.description.slice(0,260)}{product.description.length>260?"…":""}</p><a href={product.url} target="_blank" rel="noreferrer">Open product ↗</a></aside><div className="panel output-panel">{!campaign?<div className="empty">Generate the campaign to see platform variations, creatives, video guidance and SEO.</div>:<><div className="tabs">{["copy","creatives","video","seo"].map(item=><button type="button" key={item} className={`tab ${tab===item?"active":""}`} onClick={()=>setTab(item)}>{item.toUpperCase()}</button>)}</div>
      {tab==="copy"&&<div className="copy-grid">{copyCards.map(([label,text])=><div className="copy-card platform-copy-card" key={label}><h3>{label}</h3><p>{text}</p><button type="button" className={copied===label?"copy-confirmed":""} onClick={()=>cp(label,text)}>{copied===label?"Copied ✓":`Copy ${label}`}</button></div>)}</div>}
      {tab==="creatives"&&<div className="creative-grid"><CreativeCanvas label="Instagram Portrait" width={1080} height={1350} product={product} campaign={campaign} background={background} style={style as VisualStyle}/><CreativeCanvas label="Facebook Square" width={1080} height={1080} product={product} campaign={campaign} background={background} style={style as VisualStyle}/><CreativeCanvas label="Instagram Story" width={1080} height={1920} product={product} campaign={campaign} background={background} style={style as VisualStyle}/><CreativeCanvas label="Pinterest Pin" width={1000} height={1500} product={product} campaign={campaign} background={background} style={style as VisualStyle}/></div>}
      {tab==="video"&&<div className="copy-grid"><div className="copy-card"><h3>Reel/TikTok Hook</h3><p>{campaign.reelHook}</p></div><div className="copy-card"><h3>4-Scene Video Plan</h3><p>{campaign.reelScript.map((x,i)=>`${i+1}. ${x}`).join("\n\n")}</p></div></div>}
      {tab==="seo"&&<div className="copy-grid"><div className="copy-card"><h3>SEO Title</h3><p>{campaign.seoTitle}</p></div><div className="copy-card"><h3>Meta Description</h3><p>{campaign.metaDescription}</p></div><div className="copy-card full"><h3>Compliance Check</h3><p>{campaign.complianceNotes.map(x=>`• ${x}`).join("\n")}</p></div></div>}
    </>}</div></section>}
    <p className="footer-note">Approval mode is intentional: content is reviewed before publishing.</p>
  </main></div>;
}
