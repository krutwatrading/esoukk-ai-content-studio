"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function PasswordSignInForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed. Please try again.");
      setLoading(false);
    }
  }

  return <form onSubmit={submit}>
    <h2>Sign in</h2>
    <label>Email<input name="email" type="email" autoComplete="email" required disabled={loading}/></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required disabled={loading}/></label>
    <button type="submit" disabled={loading} aria-busy={loading}>{loading ? "Signing in…" : "Sign in securely"}</button>
    {error && <div className="auth-alert error" role="alert">{error}</div>}
  </form>;
}
