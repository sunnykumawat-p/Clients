import { useEffect, useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import api from "@/lib/api";
import { buildWaLink, fillTemplate, pickTemplate } from "@/lib/cp";

/**
 * WhatsApp Draft Modal — the Golden Rule surface.
 * Props:
 *   open, onClose
 *   client: { id, name, phone, preferred_language }
 *   category: string (template category key)
 *   context: extra placeholders (amount, milestone, stage)
 */
export default function WhatsAppDraft({ open, onClose, client, category = "follow_up", context = {} }) {
  const [templates, setTemplates] = useState([]);
  const [lang, setLang] = useState(client?.preferred_language || "en");
  const [pickedId, setPickedId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setLang(client?.preferred_language || "en");
    api.get("/templates").then((r) => setTemplates(r.data));
  }, [open, client]);

  useEffect(() => {
    if (!templates.length) return;
    const pool = templates.filter((t) => t.language === lang);
    const tpl = pickTemplate(pool, category, lang) || pool[0] || templates[0];
    if (!tpl) return;
    setPickedId(tpl.id);
    setMessage(
      fillTemplate(tpl.body, {
        name: client?.name || "",
        amount: context.amount,
        stage: context.stage || client?.stage,
        milestone: context.milestone,
      })
    );
  }, [templates, lang, category, client, context]);

  const onPick = (tid) => {
    const t = templates.find((x) => x.id === tid);
    if (!t) return;
    setPickedId(tid);
    setLang(t.language);
    setMessage(
      fillTemplate(t.body, {
        name: client?.name || "",
        amount: context.amount,
        stage: context.stage || client?.stage,
        milestone: context.milestone,
      })
    );
  };

  const send = async () => {
    // Log the sent message on the timeline before opening WA
    try {
      await api.post(`/clients/${client.id}/interactions`, {
        type: "message_sent",
        description: `WhatsApp sent (${lang.toUpperCase()}): ${message.slice(0, 120)}${message.length > 120 ? "…" : ""}`,
        meta: { category, language: lang },
      });
    } catch (e) {
      // ignore
    }
    const url = buildWaLink(client.phone, message);
    window.open(url, "_blank", "noopener,noreferrer");
    onClose?.();
  };

  if (!open || !client) return null;

  const langTemplates = templates.filter((t) => t.language === lang);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[rgba(45,44,42,0.35)] backdrop-blur-sm cp-fade-in"
      onClick={onClose}
      data-testid="wa-modal-overlay"
    >
      <div
        className="cp-card w-full md:max-w-lg md:rounded-2xl rounded-t-3xl overflow-hidden cp-slide-up"
        onClick={(e) => e.stopPropagation()}
        data-testid="wa-modal"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--cp-border)]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--cp-success)]/10 text-[color:var(--cp-success)] flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
            <div>
              <div className="text-[15px] font-semibold">Draft WhatsApp update</div>
              <div className="text-[12px] text-[color:var(--cp-text-3)]">To {client.name} — {client.phone || "no phone"}</div>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn-ghost" data-testid="wa-modal-close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${lang === "en" ? "bg-[color:var(--cp-accent-surface)] border-[color:var(--cp-accent)] text-[color:var(--cp-accent)]" : "border-[color:var(--cp-border)] text-[color:var(--cp-text-2)]"}`}
              data-testid="wa-lang-en"
            >
              English
            </button>
            <button
              onClick={() => setLang("hi")}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${lang === "hi" ? "bg-[color:var(--cp-accent-surface)] border-[color:var(--cp-accent)] text-[color:var(--cp-accent)]" : "border-[color:var(--cp-border)] text-[color:var(--cp-text-2)]"}`}
              data-testid="wa-lang-hi"
            >
              हिन्दी
            </button>
          </div>

          <div>
            <label className="cp-label">Template</label>
            <select
              className="cp-input"
              value={pickedId || ""}
              onChange={(e) => onPick(e.target.value)}
              data-testid="wa-template-select"
            >
              {langTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.category.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cp-label">Message</label>
            <textarea
              className="cp-input min-h-[160px] resize-y leading-relaxed"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="wa-message-body"
            />
            <div className="text-[11px] text-[color:var(--cp-text-3)] mt-1">
              You tap Send inside WhatsApp — nothing is sent automatically.
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[color:var(--cp-border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="cp-btn-secondary" data-testid="wa-modal-cancel">
            Cancel
          </button>
          <button onClick={send} className="cp-btn-primary" data-testid="wa-modal-send">
            <Send size={16} /> Open in WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
