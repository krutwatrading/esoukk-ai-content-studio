export type ProductData={title:string;handle:string;url:string;vendor?:string;productType?:string;description:string;price:number;compareAtPrice?:number|null;currency:string;images:string[];variants:Array<{id:string|number;title:string;price:number;available:boolean}>};
export type CampaignRequest={product:ProductData;goal:"new-arrival"|"sales"|"awareness"|"engagement";language:"English"|"Arabic"|"Bilingual";style:"minimal-luxury"|"editorial"|"resort"|"performance";offer?:string;audience?:string};
export type CampaignCopy={campaignAngle:string;headline:string;subheadline:string;cta:string;instagramCaption:string;facebookCaption:string;storyFrames:string[];pinterestTitle:string;pinterestDescription:string;reelHook:string;reelScript:string[];emailSubject:string;emailPreview:string;hashtags:string[];seoTitle:string;metaDescription:string;complianceNotes:string[]};


export type CreativePlatform =
  | "instagram-feed"
  | "instagram-story"
  | "instagram-reel"
  | "facebook-feed"
  | "facebook-story"
  | "tiktok"
  | "youtube-shorts"
  | "pinterest"
  | "snapchat";

export type CreativeBrief = {
  product: ProductData;
  platform: CreativePlatform;
  objective: "sales" | "awareness" | "engagement" | "retargeting";
  audience: string;
  offer?: string;
  language: "English" | "Arabic" | "Bilingual";
  tone: "luxury" | "urgent" | "ugc" | "editorial" | "performance";
};

export type CreativePlan = {
  platform: CreativePlatform;
  aspectRatio: string;
  resolution: string;
  durationSeconds: number;
  hookOptions: string[];
  primaryText: string;
  headline: string;
  cta: string;
  ugcScript: string[];
  shotList: string[];
  adVideoScenes: Array<{
    time: string;
    visual: string;
    overlay: string;
    voiceover: string;
  }>;
  imagePrompts: string[];
  complianceNotes: string[];
};
