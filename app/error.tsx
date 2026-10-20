"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application boundary caught an error", error); }, [error]);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5efe6", color: "#171717" }}>
    <section style={{ width: "min(620px,100%)", padding: 32, border: "1px solid #dccaa9", borderRadius: 24, background: "#fffaf2" }}>
      <p style={{ margin: "0 0 8px", color: "#8a651e", fontWeight: 800, letterSpacing: ".08em" }}>TEMPORARY APPLICATION ERROR</p>
      <h1 style={{ margin: "0 0 12px", fontFamily: "Georgia,serif" }}>The workspace could not finish that action.</h1>
      <p style={{ lineHeight: 1.6 }}>Your campaign remains protected. Retry the screen first; if the problem continues, reload the latest deployed application.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
        <button type="button" onClick={reset} style={{ border: 0, borderRadius: 999, padding: "12px 20px", background: "#171717", color: "white", fontWeight: 800 }}>Retry workspace</button>
        <button type="button" onClick={() => window.location.reload()} style={{ border: "1px solid #171717", borderRadius: 999, padding: "12px 20px", background: "transparent", fontWeight: 800 }}>Reload latest version</button>
      </div>
      {error.digest && <small style={{ display: "block", marginTop: 18, color: "#776f64" }}>Reference: {error.digest}</small>}
    </section>
  </main>;
}
