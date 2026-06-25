"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ProgressBar } from "@/components/ProgressBar";
import { fetchJSON, fmtDate } from "@/lib/client";
import type { Kanaal, KanaalType } from "@/lib/types";

const TYPES: { value: KanaalType; label: string }[] = [
  { value: "facebook_page", label: "Facebook Pagina" },
  { value: "linkedin_profile", label: "LinkedIn Profiel" },
  { value: "linkedin_company", label: "LinkedIn Company" },
];

const leeg = { naam: "", type: "facebook_page" as KanaalType, zapier_hook: "" };

export default function KanalenPage() {
  const [kanalen, setKanalen] = useState<Kanaal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{ naam: string; type: KanaalType; zapier_hook: string }>(leeg);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchJSON<{ kanalen: Kanaal[] }>("/api/admin/kanalen");
      setKanalen(d.kanalen);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(k: Kanaal) {
    setEditId(k.id);
    setForm({ naam: k.naam, type: k.type, zapier_hook: k.zapier_hook });
    setCreating(false);
  }

  async function save() {
    setBusy(true);
    setToast(null);
    try {
      if (creating) {
        await fetchJSON("/api/admin/kanalen", { method: "POST", body: JSON.stringify(form) });
      } else if (editId) {
        await fetchJSON("/api/admin/kanalen", {
          method: "PATCH",
          body: JSON.stringify({ id: editId, ...form }),
        });
      }
      setEditId(null);
      setCreating(false);
      setForm(leeg);
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Fout", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(k: Kanaal, status: string) {
    setBusy(true);
    try {
      await fetchJSON("/api/admin/kanalen", {
        method: "PATCH",
        body: JSON.stringify({ id: k.id, status }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function del(k: Kanaal) {
    if (!confirm(`Kanaal "${k.naam}" verwijderen? Bijbehorende routes vervallen.`)) return;
    setBusy(true);
    try {
      await fetchJSON(`/api/admin/kanalen?id=${k.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function test(k: Kanaal) {
    setBusy(true);
    setToast(null);
    try {
      const r = await fetchJSON<{ ok: boolean; status: number; body: string }>(
        "/api/admin/kanalen/test",
        { method: "POST", body: JSON.stringify({ kanaal_id: k.id }) },
      );
      setToast({ msg: `${k.naam}: HTTP ${r.status} — ${r.body}`, ok: r.ok });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Fout", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const showForm = creating || editId !== null;

  return (
    <Shell title="Kanalen" subtitle="Publish-doelen en hun Zapier-webhooks.">
      {(loading || busy) && <ProgressBar />}
      {toast && <div className={`toast ${toast.ok ? "toast--ok" : "toast--err"}`}>{toast.msg}</div>}

      <div style={{ margin: "8px 0 18px" }}>
        <button
          className="btn"
          onClick={() => {
            setCreating(true);
            setEditId(null);
            setForm(leeg);
          }}
        >
          + Nieuw kanaal
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 540 }}>
          <h3>{creating ? "Nieuw kanaal" : "Kanaal bewerken"}</h3>
          <div className="field">
            <label>Naam</label>
            <input value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} />
          </div>
          <div className="field">
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as KanaalType })}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Zapier webhook-URL</label>
            <input
              value={form.zapier_hook}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              onChange={(e) => setForm({ ...form, zapier_hook: e.target.value })}
            />
          </div>
          <div className="row-actions">
            <button className="btn" onClick={save} disabled={busy || !form.naam}>
              Opslaan
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setEditId(null);
                setCreating(false);
                setForm(leeg);
              }}
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      <table className="data">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Type</th>
            <th>Status</th>
            <th>Hook</th>
            <th>Laatste succes</th>
            <th>Laatste fout</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>
          {kanalen.map((k) => (
            <tr key={k.id}>
              <td>{k.naam}</td>
              <td>{k.type}</td>
              <td>
                <span className="badge">{k.status}</span>
              </td>
              <td>{k.zapier_hook ? <span className="mono">✓ ingesteld</span> : <span className="muted">—</span>}</td>
              <td>{fmtDate(k.last_success)}</td>
              <td style={{ maxWidth: 200 }}>
                {k.last_error_msg ? (
                  <span style={{ color: "var(--red)", fontSize: 12 }}>{k.last_error_msg}</span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <div className="row-actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => startEdit(k)}>
                    Bewerk
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    disabled={!k.zapier_hook}
                    onClick={() => test(k)}
                  >
                    Test
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setStatus(k, k.status === "actief" ? "gepauzeerd" : "actief")}
                  >
                    {k.status === "actief" ? "Pauzeer" : "Activeer"}
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => del(k)}>
                    Verwijder
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
