"use client";

import { useState } from "react";
import type { CreativePlan, CreativePlatform, ProductData } from "@/lib/types";
import { Film, Image as ImageIcon, Copy, Sparkles } from "lucide-react";

const platforms: Array<{value: CreativePlatform; label: string}> = [
  { value: "instagram-feed", label: "Instagram Feed" },
  { value: "instagram-story", label: "Instagram Story" },
  { value: "instagram-reel", label: "Instagram Reel" },
  { value: "facebook-feed", label: "Facebook Feed" },
  { value: "facebook-story", label: "Facebook Story" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube-shorts", label: "YouTube Shorts" },
  { value: "pinterest", label: "Pinterest" },
  { value: "snapchat", label: "Snapchat" }
];

export default function CreativeAgentStudio({ product }: { product: ProductData | null }) {
  const [platform, setPlatform] = useState<CreativePlatform>("instagram-reel");
  const [objective, setObjective] = useState("sales");
  const [tone, setTone] = useState("ugc");
  const [language, setLanguage] = useState("English");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("Women in the UAE seeking premium, affordable fashion");
  const [plan, setPlan] = useState<CreativePlan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    if (!product) {
      setError("Select a Shopify product first.");
      return;
    }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/creative-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, platform, objective, tone, language, offer, audience })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate.");
    } finally {
      setLoading(false);
    }
  }

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(current => current === key ? null : current), 1800);
  };

  return (
    <section className="panel creative-agent">
      <div className="picker-heading">
        <div>
          <div className="eyebrow">V2 CREATIVE AGENT</div>
          <h2>Hooks, UGC scripts and ad-video plans</h2>
          <p className="connection">Platform-ready strategy for every selected Shopify product.</p>
        </div>
      </div>

      <div className="creative-controls">
        <label>Platform<select value={platform} onChange={e=>setPlatform(e.target.value as CreativePlatform)}>
          {platforms.map(p=><option value={p.value} key={p.value}>{p.label}</option>)}
        </select></label>
        <label>Objective<select value={objective} onChange={e=>setObjective(e.target.value)}>
          <option value="sales">Sales</option><option value="retargeting">Retargeting</option>
          <option value="awareness">Awareness</option><option value="engagement">Engagement</option>
        </select></label>
        <label>Tone<select value={tone} onChange={e=>setTone(e.target.value)}>
          <option value="ugc">UGC</option><option value="luxury">Luxury</option>
          <option value="urgent">Urgent</option><option value="editorial">Editorial</option>
          <option value="performance">Performance</option>
        </select></label>
        <label>Language<select value={language} onChange={e=>setLanguage(e.target.value)}>
          <option>English</option><option>Arabic</option><option>Bilingual</option>
        </select></label>
        <label className="wide">Offer<input value={offer} onChange={e=>setOffer(e.target.value)} placeholder="Example: 15% OFF today" /></label>
        <label className="wide">Audience<input value={audience} onChange={e=>setAudience(e.target.value)} /></label>
      </div>

      <button className="secondary creative-generate" onClick={generate} disabled={loading || !product}>
        <Sparkles size={17}/> {loading ? "Generating…" : "Generate Creative Pack"}
      </button>
      {!product && <div className="status">Select a product from your Shopify catalogue above.</div>}
      {error && <div className="status error">{error}</div>}

      {plan && (
        <div className="creative-results">
          <div className="spec-card">
            <strong>{platforms.find(p=>p.value===plan.platform)?.label}</strong>
            <span>{plan.resolution} · {plan.aspectRatio} · {plan.durationSeconds}s</span>
          </div>

          <div className="result-section">
            <h3><Sparkles size={18}/> High-converting hooks</h3>
            {plan.hookOptions.map((hook,i)=>{const key=`hook-${i}`;return <div className="result-row" key={i}><span>{i+1}. {hook}</span><button type="button" className={copied===key?"copy-confirmed":""} onClick={()=>copy(key,hook)}>{copied===key?"Copied ✓":<Copy size={14}/>}</button></div>})}
          </div>

          <div className="result-section">
            <h3><Film size={18}/> UGC video script</h3>
            <pre>{plan.ugcScript.join("\n\n")}</pre>
            <button type="button" className={copied==="script"?"copy-confirmed":""} onClick={()=>copy("script",plan.ugcScript.join("\n\n"))}>{copied==="script"?"Copied ✓":"Copy script"}</button>
          </div>

          <div className="result-section">
            <h3><Film size={18}/> Ad creative video storyboard</h3>
            <div className="scene-grid">
              {plan.adVideoScenes.map((scene,i)=><article key={i}>
                <strong>{scene.time}</strong><p><b>Visual:</b> {scene.visual}</p>
                <p><b>Overlay:</b> {scene.overlay}</p><p><b>Voiceover:</b> {scene.voiceover}</p>
              </article>)}
            </div>
          </div>

          <div className="result-section">
            <h3><ImageIcon size={18}/> High-resolution image prompts</h3>
            {plan.imagePrompts.map((prompt,i)=>{const key=`prompt-${i}`;return <div className="result-row" key={i}><span>{prompt}</span><button type="button" className={copied===key?"copy-confirmed":""} onClick={()=>copy(key,prompt)}>{copied===key?"Copied ✓":<Copy size={14}/>}</button></div>})}
          </div>

          <div className="status">
            This build creates the complete production pack. Automatic finished image/video rendering remains disabled until a paid rendering provider is connected.
          </div>
        </div>
      )}
    </section>
  );
}
