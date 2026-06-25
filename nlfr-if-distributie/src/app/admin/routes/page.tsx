"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ProgressBar } from "@/components/ProgressBar";
import { fetchJSON } from "@/lib/client";
import type { Bron, Kanaal, MatchType, Route } from "@/lib/types";

const BRONNEN: Bron[] = ["nlfr", "if"];
const MATCH_TYPES: { value: MatchType; label: string }[] = [
  { value: "alle", label: "Alle items" },
  { value: "categorie_any", label: "Categorie — minstens één" },
  { value: "categorie_all", label: "Categorie — alle" },
];

interface FormState {
  bron: Bron;
  match_type: MatchType;
  match_waarden: string; // komma-gescheiden in de UI
  kanaal_id: string;
  status: "actief" | "gepauzeerd";
}

const leeg: FormState = {
  bron: "nlfr",
  match_type: "alle",
  match_waarden: "",
  kanaal_id: "",
  status: "actief",
};

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [kanalen, setKanalen] = useState<Kanaal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(leeg);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, k] = await Promise.all([
        fetchJSON<{ routes: Route[] }>("/api/admin/routes"),
        fetchJSON<{ kanalen: Kanaal[] }>("/api/admin/kanalen"),
      ]);
      setRoutes(r.routes);
      setKanalen(k.kanalen);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kanaalNaam = (id: string | null) =>
    kanalen.find((k) => k.id === id)?.naam ?? "—";

  function openNew() {
    setForm({ ...leeg, kanaal_id: kanalen[0]?.id ?? "" });
    setEditId(null);
    setError(null);
    setModal(true);
  }

  function openEdit(r: Route) {
    setForm({
      bron: r.bron,
      match_type: r.match_type,
      match_waarden: r.match_waarden.join(", "),
      kanaal_id: r.kanaal_id ?? "",
      status: r.status,
    });
    setEditId(r.id);
    setError(null);
    setModal(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      bron: form.bron,
      match_type: form.match_type,
      match_waarden:
        form.match_type === "alle"
          ? []
          : form.match_waarden.split(",").map((s) => s.trim()).filter(Boolean),
      kanaal_id: form.kanaal_id,
      status: form.status,
    };
    try {
      if (editId) {
        await fetchJSON("/api/admin/routes", {
          method: "PATCH",
          body: JSON.stringify({ id: editId, ...payload }),
        });
      } else {
        await fetchJSON("/api/admin/routes", { method: "POST", body: JSON.stringify(payload) });
      }
      setModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fout");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(r: Route) {
    setBusy(true);
    try {
      await fetchJSON("/api/admin/routes", {
        method: "PATCH",
        body: JSON.stringify({ id: r.id, status: r.status === "actief" ? "gepauzeerd" : "actief" }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function del(r: Route) {
    if (!confirm("Route verwijderen?")) return;
    setBusy(true);
    try {
      await fetchJSON(`/api/admin/routes?id=${r.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Routes" subtitle="Welke bron-items naar welk kanaal gaan.">
      {(loading || busy) && <ProgressBar />}

      <div style={{ margin: "8px 0 18px" }}>
        <button className="btn" onClick={openNew} disabled={kanalen.length === 0}>
          + Nieuwe route
        </button>
      </div>

      <table className="data">
        <thead>
          <tr>
            <th>Bron</th>
            <th>Match-type</th>
            <th>Waarden</th>
            <th>Kanaal</th>
            <th>Status</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="badge">{r.bron}</span>
              </td>
              <td>{r.match_type}</td>
              <td>{r.match_waarden.length ? r.match_waarden.join(", ") : <span className="muted">—</span>}</td>
              <td>{kanaalNaam(r.kanaal_id)}</td>
              <td>
                <span className="badge">{r.status}</span>
              </td>
              <td>
                <div className="row-actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => openEdit(r)}>
                    Bewerk
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => toggleStatus(r)}>
                    {r.status === "actief" ? "Pauzeer" : "Activeer"}
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => del(r)}>
                    Verwijder
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? "Route bewerken" : "Nieuwe route"}</h2>
            <div className="field">
              <label>Bron</label>
              <select value={form.bron} onChange={(e) => setForm({ ...form, bron: e.target.value as Bron })}>
                {BRONNEN.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Match-type</label>
              <select
                value={form.match_type}
                onChange={(e) => setForm({ ...form, match_type: e.target.value as MatchType })}
              >
                {MATCH_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {form.match_type !== "alle" && (
              <div className="field">
                <label>Categorie-waarden (komma-gescheiden)</label>
                <input
                  value={form.match_waarden}
                  placeholder="Midden- en Kleinbedrijf, Ondernemen"
                  onChange={(e) => setForm({ ...form, match_waarden: e.target.value })}
                />
              </div>
            )}
            <div className="field">
              <label>Kanaal</label>
              <select
                value={form.kanaal_id}
                onChange={(e) => setForm({ ...form, kanaal_id: e.target.value })}
              >
                {kanalen.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.naam}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "actief" | "gepauzeerd" })}
              >
                <option value="actief">actief</option>
                <option value="gepauzeerd">gepauzeerd</option>
              </select>
            </div>
            {error && <div className="toast toast--err">{error}</div>}
            <div className="row-actions" style={{ marginTop: 16 }}>
              <button className="btn" onClick={save} disabled={busy || !form.kanaal_id}>
                Opslaan
              </button>
              <button className="btn btn--ghost" onClick={() => setModal(false)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
