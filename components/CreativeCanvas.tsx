"use client";

import { useEffect, useRef } from "react";
import type { CampaignCopy, ProductData, VisualStyle } from "@/lib/types";

const themes: Record<VisualStyle, { bg: string; panel: string; text: string; accent: string }> = {
  luxury: { bg: "#ddc9a6", panel: "#f6efe5", text: "#181818", accent: "#a77b35" },
  minimal: { bg: "#f5f1eb", panel: "#fff", text: "#181818", accent: "#b99a62" },
  studio: { bg: "#e7e7e5", panel: "#fafafa", text: "#171717", accent: "#777" },
  summer: { bg: "#f3d7a6", panel: "#fff7e7", text: "#55351f", accent: "#dc7d45" },
  "uae-lifestyle": { bg: "#d9c5ac", panel: "#f7efe4", text: "#27201a", accent: "#9d7848" },
  gym: { bg: "#c9cec9", panel: "#eef0ed", text: "#142019", accent: "#55705d" },
  casual: { bg: "#d8cfc7", panel: "#f8f4ef", text: "#28231f", accent: "#a77d60" },
  resort: { bg: "#bdd8d2", panel: "#f3f4eb", text: "#183d3a", accent: "#b68a48" },
  "premium-black": { bg: "#101010", panel: "#1d1d1d", text: "#f8f1e5", accent: "#c8a96a" },
  editorial: { bg: "#d6d2cc", panel: "#f7f4ef", text: "#161616", accent: "#9e2f2f" },
};

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/), lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = `${line} ${word}`.trim();
    if (context.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const isArabic = (text: string) => /[\u0600-\u06ff]/.test(text);

async function loadImage(url: string) {
  const image = new Image();
  if (!url.startsWith("data:")) image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode().catch(() => undefined);
  return image;
}

type Props = {
  label: string;
  width: number;
  height: number;
  product: ProductData;
  campaign: CampaignCopy;
  background?: string;
  style: VisualStyle;
  onSelectForPublishing?: (dataUrl: string) => void;
  publishingLabel?: string;
};

export default function CreativeCanvas({ label, width, height, product, campaign, background, style, onSelectForPublishing, publishingLabel }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    (async () => {
      const theme = themes[style];
      const panelTop = height * (height / width <= 1.12 ? .50 : .62);
      context.fillStyle = theme.bg;
      context.fillRect(0, 0, width, height);
      const visual = await loadImage(background || product.images[0] || "");
      if (visual.naturalWidth) {
        if (background) {
          const imageAreaHeight = panelTop;
          const scale = Math.min(width * .96 / visual.naturalWidth, imageAreaHeight * .96 / visual.naturalHeight);
          const drawWidth = visual.naturalWidth * scale, drawHeight = visual.naturalHeight * scale;
          context.drawImage(visual, (width - drawWidth) / 2, (imageAreaHeight - drawHeight) / 2, drawWidth, drawHeight);
        } else {
          const imageAreaHeight = panelTop * .92;
          const scale = Math.min(width * .82 / visual.naturalWidth, imageAreaHeight / visual.naturalHeight);
          const drawWidth = visual.naturalWidth * scale, drawHeight = visual.naturalHeight * scale;
          context.shadowColor = "rgba(10,10,10,.2)";
          context.shadowBlur = 28;
          context.drawImage(visual, (width - drawWidth) / 2, height * .035 + (imageAreaHeight - drawHeight) / 2, drawWidth, drawHeight);
          context.shadowBlur = 0;
        }
      }

      context.fillStyle = theme.panel;
      context.fillRect(0, panelTop, width, height - panelTop);
      const padding = width * .07;
      const rtl = isArabic(campaign.headline + campaign.subheadline), textX = rtl ? width - padding : padding;
      context.direction = rtl ? "rtl" : "ltr";
      context.textAlign = rtl ? "right" : "left";
      const logo = await loadImage("/brand/kavia-logo.png");
      let logoBottom = panelTop + padding * .45;
      if (logo.naturalWidth) {
        const logoWidth = width * .25, logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth;
        const logoY = panelTop + padding * .28;
        context.drawImage(logo, rtl ? width - padding - logoWidth : padding, logoY, logoWidth, logoHeight);
        logoBottom = logoY + logoHeight;
      }
      const buttonHeight = width * .075, buttonWidth = width * .31;
      const buttonY = height - padding - buttonHeight;
      const subFontSize = Math.max(18, width * .026), subLineHeight = subFontSize * 1.32;
      context.font = `500 ${subFontSize}px Arial`;
      const subLines = wrap(context, campaign.subheadline, width - padding * 2);
      const visibleSubLines = subLines.slice(0, 2);
      const headlineTop = logoBottom + width * .045;
      const textBottom = buttonY - width * .035;
      const headlineSpace = Math.max(20, textBottom - headlineTop - visibleSubLines.length * subLineHeight - width * .025);
      let headlineFontSize = Math.min(width * .057, height * .046), headlineLines: string[] = [], headlineLineHeight = 0;
      do {
        context.font = `700 ${headlineFontSize}px ${rtl ? "Arial" : "Georgia"}`;
        headlineLines = wrap(context, campaign.headline.toUpperCase(), width - padding * 2);
        headlineLineHeight = headlineFontSize * 1.08;
        if (headlineLines.length * headlineLineHeight <= headlineSpace || headlineFontSize <= width * .026) break;
        headlineFontSize -= 2;
      } while (headlineFontSize > 0);
      const maximumHeadlineLines = Math.max(1, Math.floor(headlineSpace / headlineLineHeight));
      if (headlineLines.length > maximumHeadlineLines) {
        headlineLines = headlineLines.slice(0, maximumHeadlineLines);
        headlineLines[headlineLines.length - 1] = `${headlineLines[headlineLines.length - 1].replace(/[.,;:!?—-]+$/, "")}…`;
      }
      context.fillStyle = theme.text;
      context.font = `700 ${headlineFontSize}px ${rtl ? "Arial" : "Georgia"}`;
      headlineLines.forEach((line, index) => context.fillText(line, textX, headlineTop + headlineFontSize + index * headlineLineHeight));
      const subY = headlineTop + headlineLines.length * headlineLineHeight + width * .025;
      context.font = `500 ${subFontSize}px Arial`;
      visibleSubLines.forEach((line, index) => context.fillText(line, textX, subY + subFontSize + index * subLineHeight));
      const buttonX = rtl ? width - padding - buttonWidth : padding;
      context.fillStyle = theme.accent;
      context.beginPath();
      context.roundRect(buttonX, buttonY, buttonWidth, width * .075, width * .04);
      context.fill();
      context.fillStyle = "#fff";
      context.textAlign = "center";
      context.font = `700 ${width * .023}px Arial`;
      context.fillText(campaign.cta, buttonX + buttonWidth / 2, buttonY + width * .047);
    })();
  }, [width, height, product, campaign, background, style]);

  const download = () => {
    const anchor = document.createElement("a");
    anchor.download = `${product.handle}-${style}-${label.toLowerCase().replace(/\s+/g, "-")}.png`;
    anchor.href = ref.current!.toDataURL("image/png");
    anchor.click();
  };
  const select = () => { if (ref.current && onSelectForPublishing) onSelectForPublishing(ref.current.toDataURL("image/png")); };

  return <div className="creative-card"><canvas ref={ref}/><div className="creative-tools"><strong>{label} · {style.replace("-", " ")} · {width}×{height}</strong><div><a className="creative-cta-preview" href={product.url} target="_blank" rel="noreferrer">{campaign.cta} ↗</a>{onSelectForPublishing&&<button type="button" className="select-publish-creative" onClick={select}>{publishingLabel||"Use for Publishing"}</button>}<button type="button" onClick={download}>Download PNG</button></div></div><small className="canvas-note">{background ? "Complete AI campaign photograph fitted without cropping. Verify product fidelity before approval." : "Original Shopify image shown. Generate a new AI campaign image for a new scene."}</small></div>;
}
