import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { STAGES, SOURCES, formatMoney, daysAgo } from "@/lib/cp";
import StageBadge from "@/components/StageBadge";
import { Plus, Search, Users, X } from "lucide-react";
import { toast } from "sonner";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    api.get("/clients", { params: { q: q || undefined, stage: stage || undefined } }).then((r) => setClients(r.data));

  useEffect(() => {
    load();
  }, [q, stage]);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-[color:var(--cp-text-3)]">Clients</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">Everyone you know</h1>
          <p className="mt-1.5 text-[color:var(--cp-text-2)] text-[15px]">
            {clients.length} clients · every relationship, in one place.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="cp-btn-primary"
          data-testid="btn-add-client"
        >
          <Plus size={16} /> Add client
        </button>
      </div>

      <div className="cp-card p-3 md:p-4 mb-5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)]" />
          <input
            type="text"
            placeholder="Search by name or phone…"
            className="cp-input pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="clients-search"
          />
        </div>
        <select
          className="cp-input md:w-56"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          data-testid="clients-stage-filter"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {clients.length === 0 ? (
        <div className="cp-card p-10 text-center" data-testid="clients-empty">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--cp-subtle)] text-[color:var(--cp-text-2)] flex items-center justify-center mx-auto">
            <Users size={26} />
          </div>
          <h3 className="mt-4 text-xl font-semibold">No clients yet</h3>
          <p className="mt-1.5 text-[color:var(--cp-text-2)]">
            Add your first client to start remembering every interaction, quote, and payment.
          </p>
          <button onClick={() => setShowAdd(true)} className="cp-btn-primary mt-5" data-testid="btn-add-client-empty">
            <Plus size={16} /> Add your first client
          </button>
        </div>
      ) : (
        <div className="cp-card overflow-hidden">
          {clients.map((c) => (
            <Link
              key={c.id}
              to={`/clients/${c.id}`}
              className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-[color:var(--cp-border)] last:border-b-0 hover:bg-[color:var(--cp-subtle)]/60 transition-colors"
              data-testid={`client-row-${c.id}`}
            >
              <div className="col-span-12 md:col-span-5 flex items-center gap-3 min-w-0">
                <ContactDot days={c.days_since_contact} />
                <div className="min-w-0">
                  <div className="font-medium text-[color:var(--cp-text)] truncate">{c.name}</div>
                  <div className="text-[12px] text-[color:var(--cp-text-3)] truncate">
                    {c.phone || "—"} · {c.source}
                  </div>
                </div>
              </div>
              <div className="col-span-4 md:col-span-2 flex items-center">
                <StageBadge stage={c.stage} />
              </div>
              <div className="col-span-4 md:col-span-3 flex items-center text-[13px] text-[color:var(--cp-text-2)]">
                <span>
                  <span className="text-[color:var(--cp-text)] font-medium">{formatMoney(c.quoted_value)}</span>
                  {c.money.outstanding > 0 && (
                    <span className="ml-2 text-[color:var(--cp-accent)]">
                      · {formatMoney(c.money.outstanding)} due
                    </span>
                  )}
                </span>
              </div>
              <div className="col-span-4 md:col-span-2 flex items-center justify-end text-[12px] text-[color:var(--cp-text-3)]">
                {c.days_since_contact === 0 ? "Today" : `${c.days_since_contact}d ago`}
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddClientModal open={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />
    </div>
  );
}

const ContactDot = ({ days }) => {
  let color = "#4A7256"; // green
  if (days >= 3 && days < 7) color = "#D48C45";
  if (days >= 7) color = "#C05746";
  return <span className="cp-dot" style={{ background: color }} title={`${days}d since last contact`} />;
};

function AddClientModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    preferred_language: "en",
    source: "Referral",
    stage: "Lead",
    quoted_value: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open)
      setForm({
        name: "",
        phone: "",
        preferred_language: "en",
        source: "Referral",
        stage: "Lead",
        quoted_value: 0,
        notes: "",
      });
  }, [open]);

  if (!open) return null;

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/clients", { ...form, quoted_value: Number(form.quoted_value) || 0 });
      toast.success(`${form.name} added`);
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error("Could not add client");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[rgba(45,44,42,0.35)] backdrop-blur-sm cp-fade-in"
      onClick={onClose}
      data-testid="add-client-overlay"
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="cp-card w-full md:max-w-lg md:rounded-2xl rounded-t-3xl overflow-hidden cp-slide-up"
        data-testid="add-client-modal"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--cp-border)]">
          <div className="font-semibold text-[15px]">Add new client</div>
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="cp-label">Name</label>
            <input
              className="cp-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              data-testid="add-client-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">Phone (with country code)</label>
              <input
                className="cp-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+9198…"
                data-testid="add-client-phone"
              />
            </div>
            <div>
              <label className="cp-label">Language</label>
              <select
                className="cp-input"
                value={form.preferred_language}
                onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
                data-testid="add-client-language"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">Source</label>
              <select
                className="cp-input"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                data-testid="add-client-source"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="cp-label">Stage</label>
              <select
                className="cp-input"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                data-testid="add-client-stage"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="cp-label">Quoted value (₹)</label>
            <input
              type="number"
              className="cp-input"
              value={form.quoted_value}
              onChange={(e) => setForm({ ...form, quoted_value: e.target.value })}
              data-testid="add-client-quoted"
            />
          </div>
          <div>
            <label className="cp-label">Notes</label>
            <textarea
              className="cp-input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              data-testid="add-client-notes"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[color:var(--cp-border)] flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="cp-btn-primary" data-testid="add-client-save">
            {saving ? "Adding…" : "Add client"}
          </button>
        </div>
      </form>
    </div>
  );
}
