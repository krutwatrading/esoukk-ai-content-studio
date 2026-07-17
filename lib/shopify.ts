import {ProductData} from "./types";
function allowed(){return(process.env.ALLOWED_SHOPIFY_DOMAINS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean)}
const money=(v:unknown)=>{const n=Number(v||0);return Number.isFinite(n)?n/100:0};
export async function importShopifyProduct(productUrl:string):Promise<ProductData>{
 const url=new URL(productUrl); if(url.protocol!=="https:")throw new Error("Only HTTPS product URLs are accepted.");
 const domains=allowed(); if(domains.length&&!domains.includes(url.hostname.toLowerCase()))throw new Error(`This domain is not allowed. Add ${url.hostname} to ALLOWED_SHOPIFY_DOMAINS.`);
 const m=url.pathname.match(/\/products\/([^/?#]+)/); if(!m)throw new Error("Enter a Shopify product URL containing /products/product-handle.");
 const handle=m[1]; const r=await fetch(new URL(`/products/${handle}.js`,url.origin),{cache:"no-store",headers:{"User-Agent":"eSoukk-AI-Content-Studio/1.0"}});
 if(!r.ok)throw new Error(`Shopify returned ${r.status}. Confirm the product is published.`);
 const p=await r.json(); const images=(p.images||[]).map((i:string)=>i.startsWith("//")?`https:${i}`:i);
 const variants=(p.variants||[]).map((v:any)=>({id:v.id,title:v.title,price:money(v.price),available:Boolean(v.available)}));
 const prices=variants.map((v:any)=>v.price).filter(Number.isFinite); const price=prices.length?Math.min(...prices):money(p.price);
 return{title:p.title,handle,url:productUrl,vendor:p.vendor,productType:p.type,description:(p.description||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(),price,compareAtPrice:p.compare_at_price?money(p.compare_at_price):null,currency:p.currency||"AED",images,variants};
}
