"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";

type Log = { id: number; actor_id: string | null; action: string; object_type: string; object_id: string | null; metadata: Record<string, unknown>; created_at: string };

function label(action: string) {
  return action.replaceAll(".", " · ").replaceAll("_", " ");
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<Log[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/audit-logs", { cache: "no-store" }), data = await response.json();
      if (!response.ok) throw new Error(data.error || "Audit history could not be loaded.");
      setLogs(data.logs || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Audit history could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  return <section className="panel audit-trail" id="audit-trail">
    <div className="queue-heading"><div><div className="eyebrow">GOVERNANCE &amp; SECURITY</div><h2>Audit history</h2><p>Recent approvals, publishing events, imports, deletions and account disconnections.</p></div><button type="button" className="ui-action queue-refresh" onClick={load} disabled={loading}><RefreshCw size={16}/>{loading ? "Loading…" : "Refresh"}</button></div>
    {error && <div className="status error">{error}</div>}
    {!loading && !error && !logs.length && <div className="queue-empty">No audit events have been recorded yet.</div>}
    <div className="audit-list">{logs.map(log => <article key={log.id}><History size={16}/><div><strong>{label(log.action)}</strong><span>{log.object_type}{log.object_id ? ` · ${log.object_id}` : ""}</span></div><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString("en-AE", { timeZone: "Asia/Dubai" })} UAE</time></article>)}</div>
  </section>;
}
