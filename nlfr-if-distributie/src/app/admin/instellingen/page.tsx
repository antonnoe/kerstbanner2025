"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ProgressBar } from "@/components/ProgressBar";
import { fetchJSON } from "@/lib/client";
import type { Instellingen } from "@/lib/types";

export default function InstellingenPage() {
  const [data, setData] = useState<Instellingen | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetchJSON<{ instellingen: Instellingen }>("/api/admin/instellingen")
      .then((d) => setData(d.instellingen))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!data) return;
    setBusy(true);
    setToast(null);
    try {
      const d = await fetchJSON<{ instellingen: Instellingen }>("/api/admin/instellingen", {
        method: "PUT",
        body: JSON.stringify({
          admin_email: data.admin_email,
          stilte_uren: data.stilte_uren,
          foutburst_aantal: data.foutburst_aantal,
          foutburst_minuten: data.foutburst_minuten,
          alert_dedup_uren: data.alert_dedup_uren,
        }),
      });
      setData(d.instellingen);
      setToast({ msg: "Opgeslagen.", ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Fout", ok: false });
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof Instellingen>(key: K, value: Instellingen[K]) {
    if (!data) return;
    setData({ ...data, [key]: value });
  }

  return (
    <Shell title="Instellingen" subtitle="Alert-email en monitor-thresholds.">
      {(loading || busy) && <ProgressBar />}
      {toast && <div className={`toast ${toast.ok ? "toast--ok" : "toast--err"}`}>{toast.msg}</div>}

      {data && (
        <div className="card" style={{ maxWidth: 520, marginTop: 12 }}>
          <div className="field">
            <label>Admin-email (ontvangt alerts)</label>
            <input
              type="email"
              value={data.admin_email ?? ""}
              onChange={(e) => set("admin_email", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Stilte-threshold (uren)</label>
            <input
              type="number"
              min={1}
              value={data.stilte_uren}
              onChange={(e) => set("stilte_uren", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Foutburst — aantal fouten</label>
            <input
              type="number"
              min={1}
              value={data.foutburst_aantal}
              onChange={(e) => set("foutburst_aantal", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Foutburst — binnen (minuten)</label>
            <input
              type="number"
              min={1}
              value={data.foutburst_minuten}
              onChange={(e) => set("foutburst_minuten", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Alert-dedup-window (uren)</label>
            <input
              type="number"
              min={1}
              value={data.alert_dedup_uren}
              onChange={(e) => set("alert_dedup_uren", Number(e.target.value))}
            />
          </div>
          {data.nlfr_feed_url && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Gedetecteerde NLFR-feed-URL: <span className="mono">{data.nlfr_feed_url}</span>
            </p>
          )}
          <button className="btn" onClick={save} disabled={busy}>
            Opslaan
          </button>
        </div>
      )}
    </Shell>
  );
}
