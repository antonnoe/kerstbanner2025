"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ProgressBar } from "@/components/ProgressBar";
import { fetchJSON, relTime, fmtDate } from "@/lib/client";
import type { Kanaal, LogRow } from "@/lib/types";

interface Card {
  kanaal: Kanaal;
  status: { bol: "groen" | "geel" | "rood" | "grijs"; reden: string };
  heeft_hook: boolean;
  kan_replayen: boolean;
  recente_posts: Partial<LogRow>[];
}

export default function OverviewPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJSON<{ cards: Card[] }>("/api/admin/overview");
      setCards(data.cards);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Fout", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(k: Kanaal) {
    setBusyId(k.id);
    const nieuw = k.status === "gepauzeerd" ? "actief" : "gepauzeerd";
    try {
      await fetchJSON("/api/admin/kanalen", {
        method: "PATCH",
        body: JSON.stringify({ id: k.id, status: nieuw }),
      });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Fout", ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function test(k: Kanaal) {
    setBusyId(k.id);
    setToast(null);
    try {
      const r = await fetchJSON<{ ok: boolean; status: number; body: string }>(
        "/api/admin/kanalen/test",
        { method: "POST", body: JSON.stringify({ kanaal_id: k.id }) },
      );
      setToast({ msg: `Test ${k.naam}: HTTP ${r.status} — ${r.body}`, ok: r.ok });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Fout", ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function replay(k: Kanaal) {
    setBusyId(k.id);
    setToast(null);
    try {
      const r = await fetchJSON<{ ok: boolean; status: number; body: string }>(
        "/api/admin/replay",
        { method: "POST", body: JSON.stringify({ kanaal_id: k.id }) },
      );
      setToast({ msg: `Replay ${k.naam}: HTTP ${r.status} — ${r.body}`, ok: r.ok });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Fout", ok: false });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell title="Overzicht" subtitle="Status per kanaal en de laatste activiteit.">
      {loading && <ProgressBar />}
      {toast && (
        <div className={`toast ${toast.ok ? "toast--ok" : "toast--err"}`}>{toast.msg}</div>
      )}

      <div className="card-grid" style={{ marginTop: 16 }}>
        {cards.map(({ kanaal, status, heeft_hook, kan_replayen, recente_posts }) => (
          <div className="card" key={kanaal.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <h3>
                  <span className={`dot dot--${status.bol}`} title={status.reden} />
                  {kanaal.naam}
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {kanaal.type} · {status.reden}
                </span>
              </div>
              <span className="badge">{kanaal.status}</span>
            </div>

            {!heeft_hook && (
              <div className="toast toast--err" style={{ marginTop: 10 }}>
                Geen webhook ingesteld.
              </div>
            )}

            <div style={{ fontSize: 12.5, marginTop: 12, color: "var(--ink-soft)" }}>
              Laatste succes: {relTime(kanaal.last_success)}
              {kanaal.last_error_msg && (
                <div style={{ color: "var(--red)", marginTop: 4 }}>
                  Laatste fout: {kanaal.last_error_msg}
                </div>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              {recente_posts.length === 0 ? (
                <span className="muted" style={{ fontSize: 13 }}>
                  Nog geen posts.
                </span>
              ) : (
                recente_posts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      fontSize: 12.5,
                      padding: "5px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span className={`badge badge--${p.status}`} style={{ marginRight: 6 }}>
                      {p.bron}
                    </span>
                    {p.post_titel ?? p.post_url}
                    <div className="muted" style={{ fontSize: 11 }}>
                      {fmtDate(p.verzonden_op)} · {p.status}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="row-actions" style={{ marginTop: 14 }}>
              <button
                className="btn btn--ghost btn--sm"
                disabled={busyId === kanaal.id}
                onClick={() => toggle(kanaal)}
              >
                {kanaal.status === "gepauzeerd" ? "Hervat" : "Pauzeer"}
              </button>
              <button
                className="btn btn--ghost btn--sm"
                disabled={busyId === kanaal.id || !heeft_hook}
                onClick={() => test(kanaal)}
              >
                Test webhook
              </button>
              <button
                className="btn btn--ghost btn--sm"
                disabled={busyId === kanaal.id || !kan_replayen}
                onClick={() => replay(kanaal)}
              >
                Replay laatste fout
              </button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
