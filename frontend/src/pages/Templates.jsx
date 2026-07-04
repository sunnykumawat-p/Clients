import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, MessageSquareText } from "lucide-react";

const CATEGORIES = [
  { id: "follow_up", label: "Follow-Up" },
  { id: "proposal_sent", label: "Proposal Sent" },
  { id: "signed_confirmation", label: "Signed Confirmation" },
  { id: "milestone_update", label: "Milestone Update" },
  { id: "payment_reminder", label: "Payment Reminder" },
  { id: "payment_received", label: "Payment Received" },
  { id: "reengagement", label: "Re-engagement" },
];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [lang, setLang] = useState("en");
  const [editing, setEditing] = useState(null); // template object or 'new'

  const load = () => api.get("/templates").then((r) => setTemplates(r.data));
  useEffect(() => { load(); }, []);

  const langTemplates = templates.filter((t) => t.language === lang);
  const byCat = CATEGORIES.map((c) => ({
    ...c,
    items: langTemplates.filter((t) => t.category === c.id),
  }));

  const remove = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    await api.delete(`/templates/${t.id}`);
    toast.success("Template deleted");
    load();
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-[color:var(--cp-text-3)]">Message templates</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">Say the right thing, faster.</h1>
          <p className="mt-1.5 text-[color:var(--cp-text-2)] text-[15px]">
            Templates auto-fill for each client. Use placeholders <code className="text-[12px] bg-[color:var(--cp-subtle)] px-1.5 py-0.5 rounded">{"{name}"}</code>, <code className="text-[12px] bg-[color:var(--cp-subtle)] px-1.5 py-0.5 rounded">{"{amount}"}</code>, <code className="text-[12px] bg-[color:var(--cp-subtle)] px-1.5 py-0.5 rounded">{"{milestone}"}</code>, <code className="text-[12px] bg-[color:var(--cp-subtle)] px-1.5 py-0.5 rounded">{"{stage}"}</code>.
          </p>
        </div>
        <button className="cp-btn-primary" onClick={() => setEditing("new")} data-testid="btn-new-template">
          <Plus size={16} /> New template
        </button>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setLang("en")}
          className={`px-4 py-2 text-[13px] rounded-lg transition-colors ${lang === "en" ? "bg-[color:var(--cp-accent-surface)] text-[color:var(--cp-accent)] font-medium" : "text-[color:var(--cp-text-2)] hover:text-[color:var(--cp-text)]"}`}
          data-testid="tab-lang-en"
        >
          English
        </button>
        <button
          onClick={() => setLang("hi")}
          className={`px-4 py-2 text-[13px] rounded-lg transition-colors ${lang === "hi" ? "bg-[color:var(--cp-accent-surface)] text-[color:var(--cp-accent)] font-medium" : "text-[color:var(--cp-text-2)] hover:text-[color:var(--cp-text)]"}`}
          data-testid="tab-lang-hi"
        >
          हिन्दी (Hindi)
        </button>
      </div>

      <div className="space-y-4">
        {byCat.map((cat) => (
          <div key={cat.id} className="cp-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--cp-border)] flex items-center gap-2">
              <MessageSquareText size={16} className="text-[color:var(--cp-text-3)]" />
              <div className="font-medium text-[14px]">{cat.label}</div>
              <div className="text-[11px] text-[color:var(--cp-text-3)] ml-auto">{cat.items.length}</div>
            </div>
            {cat.items.length === 0 ? (
              <div className="px-5 py-4 text-[13px] text-[color:var(--cp-text-3)]">No template for this category yet.</div>
            ) : (
              cat.items.map((t) => (
                <div key={t.id} className="px-5 py-4 border-b border-[color:var(--cp-border)] last:border-b-0 flex items-start gap-3" data-testid={`template-${t.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium">{t.name}</div>
                    <div className="mt-1 text-[13.5px] text-[color:var(--cp-text-2)] whitespace-pre-line leading-relaxed">{t.body}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="cp-btn-ghost" onClick={() => setEditing(t)} data-testid={`btn-edit-template-${t.id}`}>
                      <Pencil size={14} />
                    </button>
                    <button className="cp-btn-ghost text-[color:var(--cp-accent)]" onClick={() => remove(t)} data-testid={`btn-delete-template-${t.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {editing && (
        <TemplateModal
          initial={editing === "new" ? { name: "", category: "follow_up", language: lang, body: "" } : editing}
          onClose={(saved) => {
            setEditing(null);
            if (saved) load();
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({ initial, onClose }) {
  const [form, setForm] = useState(initial);
  const isEdit = !!initial.id;

  const save = async () => {
    if (!form.name.trim() || !form.body.trim()) return;
    if (isEdit) {
      await api.put(`/templates/${initial.id}`, {
        name: form.name, category: form.category, language: form.language, body: form.body,
      });
    } else {
      await api.post("/templates", {
        name: form.name, category: form.category, language: form.language, body: form.body,
      });
    }
    toast.success(isEdit ? "Template updated" : "Template created");
    onClose(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[rgba(45,44,42,0.35)] backdrop-blur-sm cp-fade-in"
      onClick={() => onClose(null)}
    >
      <div
        className="cp-card w-full md:max-w-lg md:rounded-2xl rounded-t-3xl overflow-hidden cp-slide-up"
        onClick={(e) => e.stopPropagation()}
        data-testid="template-modal"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--cp-border)]">
          <div className="font-semibold">{isEdit ? "Edit template" : "New template"}</div>
          <button onClick={() => onClose(null)} className="cp-btn-ghost"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="cp-label">Name</label>
            <input className="cp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="template-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">Category</label>
              <select className="cp-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="template-category">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="cp-label">Language</label>
              <select className="cp-input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} data-testid="template-language">
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
          </div>
          <div>
            <label className="cp-label">Message body</label>
            <textarea
              className="cp-input min-h-[180px] leading-relaxed"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              data-testid="template-body"
              placeholder="Hi {name}, just checking in…"
            />
            <div className="text-[11px] text-[color:var(--cp-text-3)] mt-1">
              Placeholders: {"{name}"}, {"{amount}"}, {"{milestone}"}, {"{stage}"}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[color:var(--cp-border)] flex justify-end gap-2">
          <button className="cp-btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button className="cp-btn-primary" onClick={save} data-testid="template-save">{isEdit ? "Save changes" : "Create template"}</button>
        </div>
      </div>
    </div>
  );
}
