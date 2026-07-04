import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { formatMoney } from "@/lib/cp";
import StageBadge from "@/components/StageBadge";
import WhatsAppDraft from "@/components/WhatsAppDraft";
import {
  AlertCircle,
  Clock,
  Wallet,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  Inbox,
} from "lucide-react";

const CardSection = ({ title, count, icon: Icon, tint, children }) => (
  <div className="cp-card overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--cp-border)]">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: tint.bg, color: tint.fg }}
        >
          <Icon size={17} strokeWidth={2.1} />
        </div>
        <div>
          <div className="text-[15px] font-semibold">{title}</div>
          <div className="text-[12px] text-[color:var(--cp-text-3)]">
            {count} {count === 1 ? "item" : "items"} need attention
          </div>
        </div>
      </div>
    </div>
    <div>{children}</div>
  </div>
);

const Row = ({ children, testId }) => (
  <div
    className="px-5 py-3.5 flex items-center gap-3 border-b border-[color:var(--cp-border)] last:border-b-0 hover:bg-[color:var(--cp-subtle)]/60 transition-colors"
    data-testid={testId}
  >
    {children}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [wa, setWa] = useState(null); // { client, category, context }

  const load = () => api.get("/dashboard/attention").then((r) => setData(r.data));

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return (
      <div className="p-6 md:p-10 text-[color:var(--cp-text-3)]" data-testid="dashboard-loading">
        Loading today…
      </div>
    );
  }

  const openWa = (item, category, context = {}) => {
    setWa({
      client: {
        id: item.client_id,
        name: item.name,
        phone: item.phone,
        preferred_language: item.preferred_language || "en",
        stage: item.stage,
      },
      category,
      context: {
        ...context,
        stage: item.stage,
      },
    });
  };

  const s = data.stats;
  const nothingToDo = s.attention_count === 0;

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-[color:var(--cp-text-3)]">Today</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">Needs Attention Today</h1>
          <p className="mt-1.5 text-[color:var(--cp-text-2)] text-[15px]">
            Everything across every client that&apos;s asking for a nudge today.
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 cp-stagger">
        <StatCard label="Active clients" value={s.total_active} testId="stat-active" />
        <StatCard label="Pipeline value" value={formatMoney(s.pipeline_value)} testId="stat-pipeline" />
        <StatCard label="Open leads" value={s.total_leads} testId="stat-leads" />
        <StatCard
          label="Attention items"
          value={s.attention_count}
          highlight={s.attention_count > 0}
          testId="stat-attention"
        />
      </div>

      {nothingToDo && (
        <div className="cp-card p-10 text-center" data-testid="attention-empty">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--cp-success)]/10 text-[color:var(--cp-success)] flex items-center justify-center mx-auto">
            <CheckCircle2 size={26} />
          </div>
          <h3 className="mt-4 text-xl font-semibold">You&apos;re all caught up</h3>
          <p className="mt-1.5 text-[color:var(--cp-text-2)]">
            No overdue follow-ups, no silent clients, no dues to chase. Go build something.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {data.overdue_followups.length > 0 && (
          <CardSection
            title="Overdue follow-ups"
            count={data.overdue_followups.length}
            icon={AlertCircle}
            tint={{ bg: "rgba(212,140,69,0.12)", fg: "#B47530" }}
          >
            {data.overdue_followups.map((it) => (
              <Row key={it.client_id} testId={`row-followup-${it.client_id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/clients/${it.client_id}`} className="font-medium text-[color:var(--cp-text)] hover:text-[color:var(--cp-accent)] truncate">
                      {it.name}
                    </Link>
                    <StageBadge stage={it.stage} />
                  </div>
                  <div className="text-[13px] text-[color:var(--cp-text-2)] mt-0.5">{it.reason}</div>
                </div>
                <ActionButtons item={it} category="follow_up" onWa={() => openWa(it, "follow_up")} />
              </Row>
            ))}
          </CardSection>
        )}

        {data.going_quiet.length > 0 && (
          <CardSection
            title="Going quiet"
            count={data.going_quiet.length}
            icon={Clock}
            tint={{ bg: "rgba(74,110,130,0.12)", fg: "#3F5F71" }}
          >
            {data.going_quiet.map((it) => (
              <Row key={it.client_id} testId={`row-quiet-${it.client_id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/clients/${it.client_id}`} className="font-medium hover:text-[color:var(--cp-accent)] truncate">
                      {it.name}
                    </Link>
                    <StageBadge stage={it.stage} />
                  </div>
                  <div className="text-[13px] text-[color:var(--cp-text-2)] mt-0.5">{it.reason}</div>
                </div>
                <ActionButtons item={it} onWa={() => openWa(it, "reengagement")} />
              </Row>
            ))}
          </CardSection>
        )}

        {data.overdue_payments.length > 0 && (
          <CardSection
            title="Payments overdue"
            count={data.overdue_payments.length}
            icon={Wallet}
            tint={{ bg: "rgba(192,87,70,0.12)", fg: "#C05746" }}
          >
            {data.overdue_payments.map((it) => (
              <Row key={it.client_id} testId={`row-payment-${it.client_id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/clients/${it.client_id}`} className="font-medium hover:text-[color:var(--cp-accent)] truncate">
                      {it.name}
                    </Link>
                    <StageBadge stage={it.stage} />
                  </div>
                  <div className="text-[13px] text-[color:var(--cp-text-2)] mt-0.5">
                    {formatMoney(it.outstanding)} pending · {formatMoney(it.paid)} received of {formatMoney(it.quoted)}
                  </div>
                </div>
                <ActionButtons item={it} onWa={() => openWa(it, "payment_reminder", { amount: it.outstanding })} />
              </Row>
            ))}
          </CardSection>
        )}

        {data.tasks_due.length > 0 && (
          <CardSection
            title="Tasks due"
            count={data.tasks_due.length}
            icon={Inbox}
            tint={{ bg: "rgba(74,114,86,0.12)", fg: "#3F6249" }}
          >
            {data.tasks_due.map((it) => (
              <Row key={it.task_id} testId={`row-task-${it.task_id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{it.title}</span>
                  </div>
                  <div className="text-[13px] text-[color:var(--cp-text-2)] mt-0.5">
                    <Link to={`/clients/${it.client_id}`} className="hover:text-[color:var(--cp-accent)]">{it.name}</Link>
                    {" · "}
                    {it.reason}
                    {it.overdue_days > 0 && ` (${it.overdue_days} days overdue)`}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await api.post(`/tasks/${it.task_id}/complete`);
                    load();
                    openWa(it, "milestone_update", { milestone: it.title });
                  }}
                  className="cp-btn-secondary text-[13px]"
                  data-testid={`btn-task-complete-${it.task_id}`}
                >
                  <CheckCircle2 size={14} /> Mark done
                </button>
              </Row>
            ))}
          </CardSection>
        )}
      </div>

      <WhatsAppDraft
        open={!!wa}
        onClose={() => {
          setWa(null);
          load();
        }}
        client={wa?.client}
        category={wa?.category}
        context={wa?.context}
      />
    </div>
  );
}

const StatCard = ({ label, value, highlight, testId }) => (
  <div
    className={`cp-card p-4 md:p-5 ${highlight ? "ring-1 ring-[color:var(--cp-accent)]/30" : ""}`}
    data-testid={testId}
  >
    <div className="text-[11px] uppercase tracking-widest text-[color:var(--cp-text-3)]">{label}</div>
    <div className={`mt-2 text-2xl md:text-3xl font-semibold tracking-tight ${highlight ? "text-[color:var(--cp-accent)]" : ""}`}>
      {value}
    </div>
  </div>
);

const ActionButtons = ({ item, onWa }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <button
      onClick={onWa}
      className="cp-btn-primary text-[13px] px-3 py-2"
      data-testid={`btn-wa-${item.client_id || item.task_id}`}
    >
      <MessageCircle size={14} /> Draft WhatsApp
    </button>
    <Link
      to={`/clients/${item.client_id}`}
      className="cp-btn-ghost"
      data-testid={`btn-open-${item.client_id || item.task_id}`}
    >
      <ArrowRight size={16} />
    </Link>
  </div>
);
