"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { ProgressBar } from "@/components/ProgressBar";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const site =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const { error } = await getBrowserClient().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${site}/api/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <h1 className="page-title" style={{ fontSize: 20 }}>
          nlfr-if-distributie
        </h1>
        <p className="page-sub">Log in met een magic-link.</p>

        {busy && <ProgressBar />}

        {sent ? (
          <div className="toast toast--ok">
            Check je inbox — we hebben een inloglink gestuurd naar{" "}
            <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">E-mailadres</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
              />
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Bezig…" : "Stuur inloglink"}
            </button>
            {error && (
              <div className="toast toast--err" style={{ marginTop: 12 }}>
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
