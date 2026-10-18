import { createHmac, timingSafeEqual } from "crypto";

type UnsubscribePayload={organizationId:string;emailHash:string;expiresAt:number};
const secret=()=>process.env.EMAIL_UNSUBSCRIBE_SECRET||"";
const signature=(payload:string)=>createHmac("sha256",secret()).update(payload).digest("base64url");

export function createUnsubscribeToken(organizationId:string,emailHash:string){
 if(!secret())throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not configured.");
 const payload=Buffer.from(JSON.stringify({organizationId,emailHash,expiresAt:Date.now()+1000*60*60*24*365} satisfies UnsubscribePayload)).toString("base64url");
 return `${payload}.${signature(payload)}`;
}

export function verifyUnsubscribeToken(token:string):UnsubscribePayload|null{
 if(!secret())return null;
 const[payload,supplied]=token.split(".");if(!payload||!supplied)return null;
 const expected=signature(payload),a=Buffer.from(supplied),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 try{const value=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as UnsubscribePayload;return value.organizationId&&/^[a-f0-9]{64}$/.test(value.emailHash)&&value.expiresAt>Date.now()?value:null}catch{return null}
}
