import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { STAGES, SOURCES, formatMoney, formatDate, formatDateTime } from "@/lib/cp";
import StageBadge from "@/components/StageBadge";
import WhatsAppDraft from "@/components/WhatsAppDraft";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  ArrowLeft,
  MessageCircle,
  Wallet,
  Plus,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Trash2,
  X,
  StickyNote,
} from "lucide-react";

export default function ClientProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const [client, setClient] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tab, setTab] = useState("timeline");
  const [wa, setWa] = useState(null); // {category, context}
  const [modal, setModal] = useState(null); // 'note' | 'payment' | 'task' | 'stage' | 'edit'
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    const [c, tl, tk, pm] = await Promise.all([
      api.get(`/clients/${id}`),
      api.get(`/clients/${id}/timeline`),
      api.get(`/clients/${id}/tasks`),
      api.get(`/clients/${id}/payments`),
    ]);
    setClient(c.data);
    setTimeline(tl.data);
    setTasks(tk.data);
    setPayments(pm.data);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!client) return <div className="p-8 text-[color:var(--cp-text-3)]">Loading client…</div>;

  const openWa = (category, context = {}) => {
    setWa({ category, context: { ...context, stage: client.stage } });
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const doneTasks = tasks.filter((t) => t.completed);

  const deleteClient = () => {
    setConfirm({
      title: `Delete ${client.name}?`,
      message: "This will permanently clear their entire timeline, tasks, payments, and notes. This cannot be undone.",
      confirmLabel: "Delete client",
      testId: "confirm-delete-client",
      onConfirm: async () => {
        await api.delete(`/clients/${id}`);
        toast.success(`${client.name} removed`);
        nav("/clients");
      },
    });
  };

  const askDeleteTask = (t) => {
    setConfirm({
      title: `Delete task?`,
      message: `"${t.title}" will be removed. This won't affect the client's timeline history.`,
      confirmLabel: "Delete task",
      testId: "confirm-delete-task",
      onConfirm: async () => {
        await api.delete(`/tasks/${t.id}`);
        toast.success("Task removed");
        load();
      },
    });
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-5xl mx-auto">
      <Link to="/clients" className="cp-btn-ghost inline-flex mb-4" data-testid="btn-back-clients">
        <ArrowLeft size={16} /> All clients
      </Link>

      {/* Header */}
      <div className="cp-card p-5 md:p-7 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="client-name">{client.name}</h1>
              <StageBadge stage={client.stage} />
            </div>
            <div className="mt-2 text-[color:var(--cp-text-2)] text-[14px] flex items-center gap-x-4 gap-y-1 flex-wrap">
              <span>{client.phone || "no phone"}</span>
              <span>·</span>
              <span>Source: {client.source}</span>
              <span>·</span>
              <span>Language: {client.preferred_language === "hi" ? "हिन्दी" : "English"}</span>
              <span>·</span>
              <span>Added {formatDate(client.created_at)}</span>
            </div>
            {client.notes && (
              <div className="mt-3 text-[13px] text-[color:var(--cp-text-2)] italic">{client.notes}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setModal("edit")} className="cp-btn-secondary text-[13px]" data-testid="btn-edit-client">
              <Pencil size={14} /> Edit
            </button>
            <button onClick={deleteClient} className="cp-btn-ghost text-[color:var(--cp-accent)]" data-testid="btn-delete-client">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Money strip */}
        <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4">
          <MoneyCell label="Quoted" value={formatMoney(client.quoted_value)} />
          <MoneyCell label="Received" value={formatMoney(client.money.paid)} tint="var(--cp-success)" />
          <MoneyCell label="Outstanding" value={formatMoney(client.money.outstanding)} tint={client.money.outstanding > 0 ? "var(--cp-accent)" : undefined} />
        </div>

        {/* Quick action bar */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button className="cp-btn-primary text-[13px] px-3.5 py-2.5" onClick={() => openWa("follow_up")} data-testid="btn-quick-wa">
            <MessageCircle size={15} /> Send WhatsApp
          </button>
          <button className="cp-btn-secondary text-[13px] px-3.5 py-2.5" onClick={() => setModal("note")} data-testid="btn-log-note">
            <StickyNote size={15} /> Log note
          </button>
          <button className="cp-btn-secondary text-[13px] px-3.5 py-2.5" onClick={() => setModal("payment")} data-testid="btn-log-payment">
            <Wallet size={15} /> Log payment
          </button>
          <button className="cp-btn-secondary text-[13px] px-3.5 py-2.5" onClick={() => setModal("task")} data-testid="btn-add-task">
            <Plus size={15} /> Add task
          </button>
          <button className="cp-btn-secondary text-[13px] px-3.5 py-2.5" onClick={() => setModal("stage")} data-testid="btn-change-stage">
            Change stage
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {[
          { id: "timeline", label: "Timeline", icon: ClipboardList },
          { id: "tasks", label: `Tasks (${pendingTasks.length})`, icon: CheckCircle2 },
          { id: "payments", label: `Payments (${payments.length})`, icon: Wallet },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[13.5px] rounded-lg transition-colors ${tab === t.id ? "bg-[color:var(--cp-accent-surface)] text-[color:var(--cp-accent)] font-medium" : "text-[color:var(--cp-text-2)] hover:text-[color:var(--cp-text)]"}`}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <div className="cp-card p-5 md:p-6">
          {timeline.length === 0 ? (
            <div className="py-10 text-center text-[color:var(--cp-text-2)]" data-testid="timeline-empty">
              No activity logged yet. Log a note, payment, or task above.
            </div>
          ) : (
            <ol className="relative border-l border-[color:var(--cp-border)] pl-6 space-y-5" data-testid="timeline-list">
              {timeline.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[30px] top-1.5 cp-timeline-dot" />
                  <div className="text-[12px] text-[color:var(--cp-text-3)] uppercase tracking-wider">
                    {formatDateTime(e.created_at)} · {e.type.replace(/_/g, " ")}
                  </div>
                  <div className="mt-0.5 text-[15px] text-[color:var(--cp-text)] leading-relaxed">{e.description}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="cp-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[color:var(--cp-border)] flex items-center justify-between">
              <div className="font-medium">Pending</div>
              <button onClick={() => setModal("task")} className="cp-btn-ghost text-[13px]" data-testid="btn-add-task-2">
                <Plus size={14} /> New task
              </button>
            </div>
            {pendingTasks.length === 0 ? (
              <div className="px-5 py-8 text-center text-[color:var(--cp-text-2)]">All caught up — no pending tasks.</div>
            ) : (
              pendingTasks.map((t) => (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 border-b border-[color:var(--cp-border)] last:border-b-0" data-testid={`task-row-${t.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-[12px] text-[color:var(--cp-text-3)]">Due {formatDate(t.due_date)}</div>
                  </div>
                  <button
                    onClick={async () => {
                      await api.post(`/tasks/${t.id}/complete`);
                      await load();
                      openWa("milestone_update", { milestone: t.title });
                    }}
                    className="cp-btn-secondary text-[13px]"
                    data-testid={`btn-complete-task-${t.id}`}
                  >
                    <CheckCircle2 size={14} /> Complete
                  </button>
                  <button
                    onClick={() => askDeleteTask(t)}
                    className="cp-btn-ghost text-[color:var(--cp-accent)]"
                    aria-label="Delete task"
                    data-testid={`btn-delete-task-${t.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {doneTasks.length > 0 && (
            <div className="cp-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[color:var(--cp-border)] font-medium text-[color:var(--cp-text-2)]">Done</div>
              {doneTasks.map((t) => (
                <div key={t.id} className="px-5 py-3 border-b border-[color:var(--cp-border)] last:border-b-0 flex items-center gap-2 text-[color:var(--cp-text-2)]">
                  <CheckCircle2 size={15} className="text-[color:var(--cp-success)]" />
                  <div className="flex-1">
                    <div className="line-through">{t.title}</div>
                    <div className="text-[11px] text-[color:var(--cp-text-3)]">Completed {formatDateTime(t.completed_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="cp-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[color:var(--cp-border)] flex items-center justify-between">
            <div>
              <div className="font-medium">Payments received</div>
              <div className="text-[12px] text-[color:var(--cp-text-3)]">
                {formatMoney(client.money.paid)} of {formatMoney(client.money.quoted)} received · {formatMoney(client.money.outstanding)} outstanding
              </div>
            </div>
            <button onClick={() => setModal("payment")} className="cp-btn-primary text-[13px] px-3 py-2" data-testid="btn-add-payment">
              <Plus size={14} /> Log payment
            </button>
          </div>
          {payments.length === 0 ? (
            <div className="px-5 py-8 text-center text-[color:var(--cp-text-2)]">No payments logged yet.</div>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center gap-3 border-b border-[color:var(--cp-border)] last:border-b-0">
                <div className="flex-1">
                  <div className="font-medium">{formatMoney(p.amount)} <span className="text-[13px] font-normal text-[color:var(--cp-text-3)]">via {p.method}</span></div>
                  <div className="text-[12px] text-[color:var(--cp-text-3)]">{formatDateTime(p.received_at)}{p.note ? ` · ${p.note}` : ""}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <WhatsAppDraft
        open={!!wa}
        onClose={() => {
          setWa(null);
          load();
        }}
        client={client}
        category={wa?.category}
        context={wa?.context}
      />

      {modal === "note" && (
        <NoteModal
          client={client}
          onClose={(saved) => {
            setModal(null);
            if (saved) load();
          }}
        />
      )}
      {modal === "payment" && (
        <PaymentModal
          client={client}
          onClose={(saved) => {
            setModal(null);
            if (saved) {
              load();
              openWa("payment_received", { amount: saved.amount });
            }
          }}
        />
      )}
      {modal === "task" && (
        <TaskModal
          client={client}
          onClose={(saved) => {
            setModal(null);
            if (saved) load();
          }}
        />
      )}
      {modal === "stage" && (
        <StageModal
          client={client}
          onClose={(newStage) => {
            setModal(null);
            if (newStage) {
              load();
              const map = {
                Signed: "signed_confirmation",
                "In Progress": "milestone_update",
                Delivered: "milestone_update",
                Negotiating: "proposal_sent",
                Pitched: "proposal_sent",
              };
              openWa(map[newStage] || "follow_up");
            }
          }}
        />
      )}
      {modal === "edit" && (
        <EditClientModal
          client={client}
          onClose={(saved) => {
            setModal(null);
            if (saved) load();
          }}
        />
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

const MoneyCell = ({ label, value, tint }) => (
  <div className="cp-card p-4">
    <div className="text-[11px] uppercase tracking-widest text-[color:var(--cp-text-3)]">{label}</div>
    <div className="mt-1.5 text-xl font-semibold" style={tint ? { color: tint } : {}}>{value}</div>
  </div>
);

function ModalShell({ title, onClose, children, footer, testId }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[rgba(45,44,42,0.35)] backdrop-blur-sm cp-fade-in"
      onClick={() => onClose(null)}
      data-testid={`${testId}-overlay`}
    >
      <div
        className="cp-card w-full md:max-w-md md:rounded-2xl rounded-t-3xl overflow-hidden cp-slide-up"
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--cp-border)]">
          <div className="font-semibold">{title}</div>
          <button onClick={() => onClose(null)} className="cp-btn-ghost">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
        <div className="px-5 py-4 border-t border-[color:var(--cp-border)] flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function NoteModal({ client, onClose }) {
  const [text, setText] = useState("");
  const save = async () => {
    if (!text.trim()) return;
    await api.post(`/clients/${client.id}/interactions`, { type: "note", description: text });
    toast.success("Note added");
    onClose(true);
  };
  return (
    <ModalShell
      title="Log a note"
      onClose={onClose}
      testId="note-modal"
      footer={
        <>
          <button className="cp-btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button className="cp-btn-primary" onClick={save} data-testid="note-save">Save note</button>
        </>
      }
    >
      <label className="cp-label">What happened?</label>
      <textarea
        className="cp-input min-h-[120px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Called client, discussed timeline for Phase 2."
        data-testid="note-input"
        autoFocus
      />
    </ModalShell>
  );
}

function PaymentModal({ client, onClose }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [note, setNote] = useState("");
  const save = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return;
    const { data } = await api.post(`/clients/${client.id}/payments`, { amount: a, method, note });
    toast.success(`${formatMoney(a)} recorded`);
    onClose(data);
  };
  return (
    <ModalShell
      title="Log payment received"
      onClose={onClose}
      testId="payment-modal"
      footer={
        <>
          <button className="cp-btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button className="cp-btn-primary" onClick={save} data-testid="payment-save">Log payment</button>
        </>
      }
    >
      <div>
        <label className="cp-label">Amount (₹)</label>
        <input
          type="number"
          className="cp-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 15000"
          data-testid="payment-amount"
          autoFocus
        />
      </div>
      <div>
        <label className="cp-label">Method</label>
        <select className="cp-input" value={method} onChange={(e) => setMethod(e.target.value)} data-testid="payment-method">
          <option>UPI</option>
          <option>Cash</option>
          <option>Bank Transfer</option>
        </select>
      </div>
      <div>
        <label className="cp-label">Note (optional)</label>
        <input className="cp-input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="payment-note" placeholder="e.g. Advance for Phase 1" />
      </div>
    </ModalShell>
  );
}

function TaskModal({ client, onClose }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const save = async () => {
    if (!title.trim()) return;
    const iso = due ? new Date(due).toISOString() : null;
    await api.post(`/clients/${client.id}/tasks`, { title, due_date: iso });
    toast.success("Task added");
    onClose(true);
  };
  return (
    <ModalShell
      title="Add task / milestone"
      onClose={onClose}
      testId="task-modal"
      footer={
        <>
          <button className="cp-btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button className="cp-btn-primary" onClick={save} data-testid="task-save">Add task</button>
        </>
      }
    >
      <div>
        <label className="cp-label">Title</label>
        <input className="cp-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build Services section" data-testid="task-title" autoFocus />
      </div>
      <div>
        <label className="cp-label">Due date</label>
        <input type="date" className="cp-input" value={due} onChange={(e) => setDue(e.target.value)} data-testid="task-due" />
      </div>
    </ModalShell>
  );
}

function StageModal({ client, onClose }) {
  const [stage, setStage] = useState(client.stage);
  const save = async () => {
    if (stage === client.stage) return onClose(null);
    await api.post(`/clients/${client.id}/stage`, { stage });
    toast.success(`Stage → ${stage}`);
    onClose(stage);
  };
  return (
    <ModalShell
      title="Change stage"
      onClose={onClose}
      testId="stage-modal"
      footer={
        <>
          <button className="cp-btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button className="cp-btn-primary" onClick={save} data-testid="stage-save">Update stage</button>
        </>
      }
    >
      <label className="cp-label">New stage</label>
      <select className="cp-input" value={stage} onChange={(e) => setStage(e.target.value)} data-testid="stage-select">
        {STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </ModalShell>
  );
}

function EditClientModal({ client, onClose }) {
  const [form, setForm] = useState({
    name: client.name,
    phone: client.phone || "",
    preferred_language: client.preferred_language,
    source: client.source,
    stage: client.stage,
    quoted_value: client.quoted_value,
    notes: client.notes || "",
  });
  const save = async () => {
    await api.put(`/clients/${client.id}`, { ...form, quoted_value: Number(form.quoted_value) || 0 });
    toast.success("Client updated");
    onClose(true);
  };
  return (
    <ModalShell
      title="Edit client"
      onClose={onClose}
      testId="edit-client-modal"
      footer={
        <>
          <button className="cp-btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button className="cp-btn-primary" onClick={save} data-testid="edit-client-save">Save</button>
        </>
      }
    >
      <div>
        <label className="cp-label">Name</label>
        <input className="cp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="edit-client-name" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="cp-label">Phone</label>
          <input className="cp-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="cp-label">Language</label>
          <select className="cp-input" value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="cp-label">Source</label>
          <select className="cp-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="cp-label">Stage</label>
          <select className="cp-input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {STAGES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
      </div>
      <div>
        <label className="cp-label">Quoted (₹)</label>
        <input type="number" className="cp-input" value={form.quoted_value} onChange={(e) => setForm({ ...form, quoted_value: e.target.value })} />
      </div>
      <div>
        <label className="cp-label">Notes</label>
        <textarea className="cp-input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </ModalShell>
  );
}
