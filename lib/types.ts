export type ProductData={title:string;handle:string;url:string;vendor?:string;productType?:string;description:string;price:number;compareAtPrice?:number|null;currency:string;images:string[];variants:Array<{id:string|number;title:string;price:number;available:boolean}>};
export type BrandProfile={storeName:string;websiteUrl:string;voice:string[];audiences:string[];approvedCtas:string[];prohibitedClaims:string[]};
export type VisualStyle="luxury"|"minimal"|"studio"|"summer"|"uae-lifestyle"|"gym"|"casual"|"resort"|"premium-black"|"editorial";
export type CampaignRequest={product:ProductData;goal:"new-arrival"|"sales"|"awareness"|"engagement";language:"English"|"Arabic"|"Bilingual";style:VisualStyle;offer?:string;audience?:string;brandProfile?:BrandProfile};
export type CampaignCopy={campaignAngle:string;headline:string;subheadline:string;cta:string;instagramCaption:string;instagramHashtags:string[];facebookCaption:string;facebookHashtags:string[];storyFrames:string[];pinterestTitle:string;pinterestDescription:string;pinterestHashtags:string[];xPost:string;linkedinPost:string;tiktokCaption:string;tiktokHashtags:string[];reelHook:string;reelScript:string[];emailSubject:string;emailPreview:string;emailBody:string;hashtags:string[];seoTitle:string;metaDescription:string;complianceNotes:string[]};


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
