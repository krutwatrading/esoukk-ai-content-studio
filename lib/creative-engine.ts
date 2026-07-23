import type { CreativeBrief, CreativePlan } from "./types";

const PLATFORM_SPECS = {
  "instagram-feed": { aspectRatio: "4:5", resolution: "1080×1350", durationSeconds: 15 },
  "instagram-story": { aspectRatio: "9:16", resolution: "1080×1920", durationSeconds: 15 },
  "instagram-reel": { aspectRatio: "9:16", resolution: "1080×1920", durationSeconds: 20 },
  "facebook-feed": { aspectRatio: "4:5", resolution: "1080×1350", durationSeconds: 15 },
  "facebook-story": { aspectRatio: "9:16", resolution: "1080×1920", durationSeconds: 15 },
  "tiktok": { aspectRatio: "9:16", resolution: "1080×1920", durationSeconds: 20 },
  "youtube-shorts": { aspectRatio: "9:16", resolution: "1080×1920", durationSeconds: 25 },
  "pinterest": { aspectRatio: "2:3", resolution: "1000×1500", durationSeconds: 15 },
  "snapchat": { aspectRatio: "9:16", resolution: "1080×1920", durationSeconds: 10 },
  "whatsapp": { aspectRatio: "1:1", resolution: "1080×1080", durationSeconds: 15 }
} as const;

const clean = (value?: string) => (value || "").replace(/\s+/g, " ").trim();

function productName(title: string) {
  return clean(title).replace(/\s*[-–|].*$/, "").slice(0, 70);
}

export function generateCreativePlan(brief: CreativeBrief): CreativePlan {
  const p = brief.product;
  const name = productName(p.title);
  const price = `${p.currency} ${p.price.toFixed(0)}`;
  const offer = clean(brief.offer);
  const specs = PLATFORM_SPECS[brief.platform];

  const hookOptions = [
    `Stop scrolling—this ${name} is made for the look you keep saving.`,
    `The easiest way to upgrade your outfit in seconds.`,
    `UAE shoppers: this is the piece your wardrobe was missing.`,
    offer ? `${offer}—but only while stock lasts.` : `Premium look. Effortless styling. Everyday value.`,
    `POV: you finally found the piece that works with everything.`,
    `Three reasons this ${name} deserves a place in your wardrobe.`,
    `This is what affordable luxury should look like.`,
    `Before you buy another basic, see this.`,
    `The detail everyone notices first.`,
    `One piece, multiple looks, zero effort.`
  ];

  const imagePrompts = [
    `Ultra-realistic premium ecommerce campaign image of ${name}, exact product proportions and color preserved, clean luxury studio, soft directional light, realistic shadows, ${specs.aspectRatio} composition, high-resolution advertising photography, no text, no logos, no distortion.`,
    `Authentic UGC-style lifestyle photo featuring ${name}, modern UAE city setting, natural daylight, candid smartphone aesthetic, realistic skin and fabric texture, exact product details preserved, high-resolution, ${specs.aspectRatio}, no text.`,
    `High-converting editorial product image of ${name}, warm ivory and champagne-gold set design, premium minimal fashion campaign, crisp product focus, realistic depth, ${specs.aspectRatio}, no text or watermark.`
  ];

  const ugcScript = [
    `HOOK: “I wasn’t expecting this ${name} to look this premium in real life.”`,
    `PROBLEM: “I wanted something stylish that still felt practical and easy to wear.”`,
    `DEMO: Show the product close-up, key detail, fit or capacity, then one full-look shot.`,
    `PROOF: “The finish, shape and styling are what make it look much more expensive.”`,
    offer ? `OFFER: “It’s currently ${offer}.”` : `VALUE: “It gives the premium look without the premium-brand price.”`,
    `CTA: “Tap Shop Now before your preferred colour or size sells out.”`
  ];

  const shotList = [
    "0–2 sec: Immediate close-up or pattern-interrupt movement.",
    "2–5 sec: Full product reveal in natural light.",
    "5–9 sec: Demonstrate the strongest benefit or detail.",
    "9–13 sec: Show styling, fit, use case or transformation.",
    `13–${specs.durationSeconds} sec: Price/offer, social proof and strong Shop Now CTA.`
  ];

  const adVideoScenes = [
    {
      time: "0–2s",
      visual: "Fast product reveal, hand movement or outfit transition.",
      overlay: hookOptions[0],
      voiceover: hookOptions[4]
    },
    {
      time: "2–6s",
      visual: "Close-up of material, construction and strongest visible detail.",
      overlay: "Premium detail. Everyday versatility.",
      voiceover: `Meet the ${name}—designed to elevate your everyday look.`
    },
    {
      time: "6–11s",
      visual: "Show the product in use from two or three angles.",
      overlay: `Available from ${price}`,
      voiceover: `Easy to style, practical to use, and made for more than one occasion.`
    },
    {
      time: `11–${Math.max(13, specs.durationSeconds - 3)}s`,
      visual: "Lifestyle or UGC proof moment.",
      overlay: offer || "Affordable luxury at eSoukk",
      voiceover: offer || "Premium style without the premium-brand markup."
    },
    {
      time: `${Math.max(13, specs.durationSeconds - 3)}–${specs.durationSeconds}s`,
      visual: "Clean packshot with product name and eSoukk branding.",
      overlay: "SHOP NOW",
      voiceover: "Tap Shop Now before it sells out."
    }
  ];

  return {
    platform: brief.platform,
    aspectRatio: specs.aspectRatio,
    resolution: specs.resolution,
    durationSeconds: specs.durationSeconds,
    hookOptions,
    primaryText: `${name}. ${offer || "Premium style made easy."}\n\nShop now at eSoukk.`,
    headline: offer || `${name} | Shop Now`,
    cta: "SHOP NOW",
    ugcScript,
    shotList,
    adVideoScenes,
    imagePrompts,
    complianceNotes: [
      "This version generates hooks, scripts, storyboards, prompts and platform-ready production plans automatically.",
      "Free Mode does not render photorealistic AI images or finished UGC/ad videos.",
      "Actual image/video rendering requires a connected paid generation provider or manually supplied product footage.",
      "Verify product claims, pricing, discounts, stock and delivery statements before publishing.",
      "Do not generate fake customer testimonials or misleading before/after results."
    ]
  };
}
