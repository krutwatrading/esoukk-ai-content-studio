"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Save } from "lucide-react";
import type { CampaignCopy, ProductData } from "@/lib/types";

type Draft = { id: string; variationId: string };
type Platform = "instagram" | "facebook";
type State = "editing" | "saving" | "review" | "approving" | "approved" | "scheduling" | "scheduled";

export default function PublishingApprovalPanel({ product, campaign, publishImage }: { product: ProductData; campaign: CampaignCopy; publishImage?: string }) {
  const captions: Record<Platform, string> = {
    instagram: `${campaign.instagramCaption}\n\n${campaign.instagramHashtags.join(" ")}`,
    facebook: `${campaign.facebookCaption}\n\n${campaign.facebookHashtags.join(" ")}`,
  };
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [caption, setCaption] = useState(captions.instagram);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [state, setState] = useState<State>("editing");
  const [message, setMessage] = useState("");
  const label = platform === "facebook" ? "Facebook" : "Instagram";

  async function call(method: "POST" | "PATCH", body: unknown) {
    const response = await fetch("/api/meta/campaigns", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Publishing action failed.");
    return data;
  }

  function choosePlatform(next: Platform) {
    setPlatform(next);
    setCaption(captions[next]);
    setMessage("");
  }

  async function saveDraft() {
    setState("saving");
    setMessage("");
    try {
      let imageUrl = publishImage || product.images[0];
      if (publishImage?.startsWith("data:")) {
        const upload = await fetch("/api/meta/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: publishImage }) });
        const asset = await upload.json();
        if (!upload.ok) throw new Error(asset.error);
        imageUrl = asset.url;
      }
      const data = await call("POST", { product, caption, imageUrl, platform });
      setDraft({ id: data.campaign.id, variationId: data.campaign.variationId });
      setState("review");
      setMessage(`${label} draft saved with the selected creative. Review it before approval.`);
    } catch (error) {
      setState("editing");
      setMessage(error instanceof Error ? error.message : "Unable to save draft.");
    }
  }

  async function approve() {
    if (!draft) return;
    setState("approving");
    try {
      await call("PATCH", { action: "approve", campaignId: draft.id, variationId: draft.variationId });
      setState("approved");
      setMessage("Approved ✓ This still has not been published.");
    } catch (error) {
      setState("review");
      setMessage(error instanceof Error ? error.message : "Unable to approve.");
    }
  }

  async function schedule() {
    if (!draft) return;
    setState("scheduling");
    try {
      const iso = new Date(`${scheduledFor}:00+04:00`).toISOString();
      await call("PATCH", { action: "schedule", campaignId: draft.id, variationId: draft.variationId, scheduledFor: iso });
      setState("scheduled");
      setMessage(`Scheduled ✓ for ${scheduledFor.replace("T", " ")} UAE time.`);
    } catch (error) {
      setState("approved");
      setMessage(error instanceof Error ? error.message : "Unable to schedule.");
    }
  }

  const preview = publishImage || product.images[0];
  return <section className="publishing-approval">
    <div className="publishing-title"><div><span>META APPROVAL</span><h3>Review the final post</h3><small className={publishImage ? "creative-selected" : "creative-fallback"}>{publishImage ? "Designed social creative selected ✓" : "Using original Shopify image — select a creative in the Creatives tab"}</small></div><strong className={`publishing-state ${state}`}>{state === "review" ? "READY FOR REVIEW" : state === "saving" ? "SAVING…" : state === "approving" ? "APPROVING…" : state === "scheduling" ? "SCHEDULING…" : state.toUpperCase()}</strong></div>
    <div className="publishing-platform" role="group" aria-label="Publishing channel"><button type="button" className={platform === "instagram" ? "active" : ""} onClick={() => choosePlatform("instagram")} disabled={state !== "editing"}>Instagram</button><button type="button" className={platform === "facebook" ? "active" : ""} onClick={() => choosePlatform("facebook")} disabled={state !== "editing"}>Facebook Page</button></div>
    <div className="publishing-preview"><img src={preview} alt={product.title}/><label>FINAL {label.toUpperCase()} CAPTION<textarea value={caption} onChange={event => setCaption(event.target.value)} disabled={state !== "editing"}/><small>{caption.length} characters</small></label></div>
    <div className="publishing-actions">
      {!draft && <button type="button" className="ui-action" onClick={saveDraft} disabled={state === "saving" || !caption.trim()}><Save size={16}/>{state === "saving" ? "Uploading & saving…" : `Save ${label} Draft`}</button>}
      {(state === "review" || state === "approving") && <button type="button" className="ui-action approve" onClick={approve} disabled={state === "approving"}><CheckCircle2 size={16}/>{state === "approving" ? "Approving…" : `Approve ${label} Post`}</button>}
      {(state === "approved" || state === "scheduling") && <><label>UAE DATE &amp; TIME<input type="datetime-local" value={scheduledFor} onChange={event => setScheduledFor(event.target.value)} disabled={state === "scheduling"}/></label><button type="button" className="ui-action" onClick={schedule} disabled={!scheduledFor || state === "scheduling"}><CalendarClock size={16}/>{state === "scheduling" ? "Scheduling…" : "Schedule"}</button></>}
      {state === "scheduled" && <button type="button" className="ui-action action-complete" disabled><CheckCircle2 size={16}/>Scheduled ✓</button>}
    </div>
    {message && <p className="publishing-message">{message}</p>}
  </section>;
}
