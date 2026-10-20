"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Global application boundary caught an error", error); }, [error]);
  return <html lang="en"><body style={{ margin: 0 }}><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5efe6", color: "#171717", fontFamily: "Arial,sans-serif" }}>
    <section style={{ width: "min(620px,100%)", padding: 32, border: "1px solid #dccaa9", borderRadius: 24, background: "#fffaf2" }}>
      <p style={{ margin: "0 0 8px", color: "#8a651e", fontWeight: 800, letterSpacing: ".08em" }}>WORKSPACE RECOVERY</p>
      <h1 style={{ margin: "0 0 12px", fontFamily: "Georgia,serif" }}>A browser error interrupted this screen.</h1>
      <p style={{ lineHeight: 1.6 }}>No campaign is sent by this error. Retry or reload the latest deployed version to continue safely.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
        <button type="button" onClick={reset} style={{ border: 0, borderRadius: 999, padding: "12px 20px", background: "#171717", color: "white", fontWeight: 800 }}>Retry workspace</button>
        <button type="button" onClick={() => window.location.reload()} style={{ border: "1px solid #171717", borderRadius: 999, padding: "12px 20px", background: "transparent", fontWeight: 800 }}>Reload latest version</button>
      </div>
      {error.digest && <small style={{ display: "block", marginTop: 18, color: "#776f64" }}>Reference: {error.digest}</small>}
    </section>
  </main></body></html>;
}
