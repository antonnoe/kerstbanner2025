"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ProgressBar } from "@/components/ProgressBar";
import { fetchJSON, fmtDate } from "@/lib/client";
import type { Kanaal, LogRow } from "@/lib/types";

const STATUSSEN = ["verzonden", "overgeslagen_dedup", "fout", "wacht"];

export default function LogPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [kanalen, setKanalen] = useState<Kanaal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<LogRow | null>(null);

  const [bron, setBron] = useState("");
  const [kanaalId, setKanaalId] = useState("");
  const [status, setStatus] = useState("");
  const [van, setVan] = useState("");
  const [tot, setTot] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (bron) params.set("bron", bron);
      if (kanaalId) params.set("kanaal_id", kanaalId);
      if (status) params.set("status", status);
      if (van) params.set("van", new Date(van).toISOString());
      if (tot) params.set("tot", new Date(tot + "T23:59:59").toISOString());
      const d = await fetchJSON<{
        rows: LogRow[];
        pages: number;
        total: number;
      }>(`/api/admin/log?${params.toString()}`);
      setRows(d.rows);
      setPages(d.pages);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, [page, bron, kanaalId, status, van, tot]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchJSON<{ kanalen: Kanaal[] }>("/api/admin/kanalen").then((d) => setKanalen(d.kanalen));
  }, []);

  const kanaalNaam = (id: string | null) => kanalen.find((k) => k.id === id)?.naam ?? "—";

  function resetFilters() {
    setBron("");
    setKanaalId("");
    setStatus("");
    setVan("");
    setTot("");
    setPage(0);
  }

  return (
    <Shell title="Log" subtitle={`${total} regels totaal.`}>
      {loading && <ProgressBar />}

      <div
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 18 }}
      >
        <div className="field" style={{ margin: 0, minWidth: 120 }}>
          <label>Bron</label>
          <select value={bron} onChange={(e) => { setPage(0); setBron(e.target.value); }}>
            <option value="">alle</option>
            <option value="nlfr">nlfr</option>
            <option value="if">if</option>
            <option value="test">test</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 160 }}>
          <label>Kanaal</label>
          <select value={kanaalId} onChange={(e) => { setPage(0); setKanaalId(e.target.value); }}>
            <option value="">alle</option>
            {kanalen.map((k) => (
              <option key={k.id} value={k.id}>
                {k.naam}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 160 }}>
          <label>Status</label>
          <select value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
            <option value="">alle</option>
            {STATUSSEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Van</label>
          <input type="date" value={van} onChange={(e) => { setPage(0); setVan(e.target.value); }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Tot</label>
          <input type="date" value={tot} onChange={(e) => { setPage(0); setTot(e.target.value); }} />
        </div>
        <button className="btn btn--ghost btn--sm" onClick={resetFilters}>
          Wis filters
        </button>
      </div>

      <table className="data">
        <thead>
          <tr>
            <th>Tijd</th>
            <th>Bron</th>
            <th>Titel</th>
            <th>Kanaal</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setDetail(r)}>
              <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.verzonden_op)}</td>
              <td>{r.bron}</td>
              <td>{r.post_titel ?? r.post_url}</td>
              <td>{kanaalNaam(r.kanaal_id)}</td>
              <td>
                <span className={`badge badge--${r.status}`}>{r.status}</span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 24 }}>
                Geen regels gevonden.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <button className="btn btn--ghost btn--sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
          ← Vorige
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          Pagina {page + 1} van {Math.max(1, pages)}
        </span>
        <button
          className="btn btn--ghost btn--sm"
          disabled={page + 1 >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Volgende →
        </button>
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h2>Log-regel #{detail.id}</h2>
            <p style={{ fontSize: 13 }}>
              <strong>{detail.post_titel ?? "(geen titel)"}</strong>
              <br />
              <a href={detail.post_url} target="_blank" rel="noreferrer" className="mono">
                {detail.post_url}
              </a>
            </p>
            <p style={{ fontSize: 13 }}>
              {detail.bron} → {kanaalNaam(detail.kanaal_id)} ·{" "}
              <span className={`badge badge--${detail.status}`}>{detail.status}</span> ·{" "}
              {fmtDate(detail.verzonden_op)}
            </p>
            {detail.fout_msg && <div className="toast toast--err">{detail.fout_msg}</div>}
            <div className="field" style={{ marginTop: 12 }}>
              <label>Payload</label>
              <pre className="mono" style={{ background: "var(--maroon-08)", padding: 12, borderRadius: 6, overflow: "auto" }}>
                {JSON.stringify(detail.payload, null, 2)}
              </pre>
            </div>
            {detail.response && (
              <div className="field">
                <label>Response</label>
                <pre className="mono" style={{ background: "var(--maroon-08)", padding: 12, borderRadius: 6, overflow: "auto" }}>
                  {detail.response}
                </pre>
              </div>
            )}
            <button className="btn btn--ghost" onClick={() => setDetail(null)}>
              Sluiten
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
