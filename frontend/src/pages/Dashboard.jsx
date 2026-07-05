import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { formatMoney, stageClass } from "@/lib/cp";
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
  TrendingUp,
  TrendingDown,
  Users,
  Coins,
  Activity,
  Sparkle,
  CalendarDays,
  HeartHandshake,
  Repeat2,
} from "lucide-react";

// Small helper for month-over-month deltas rendered on KPI cards.
function monthDelta(current, previous, format) {
  if (previous == null) return null;
  const diff = (current || 0) - (previous || 0);
  if (diff === 0 && previous === 0) return null;
  const up = diff >= 0;
  return {
    up,
    label: `${up ? "↑" : "↓"} ${format(Math.abs(diff))} vs last month`,
  };
}

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
            {count === 1 ? "1 item needs attention" : `${count} items need attention`}
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

      {/* Primary KPI strip — attention-critical */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 cp-stagger">
        <StatCard
          label="Active clients"
          value={s.total_active}
          sub={`${s.total_clients} total in workspace`}
          icon={Users}
          testId="stat-active"
        />
        <StatCard
          label="Pipeline value"
          value={formatMoney(s.pipeline_value)}
          sub={`Avg deal ${formatMoney(s.avg_deal_size)}`}
          icon={TrendingUp}
          testId="stat-pipeline"
        />
        <StatCard
          label="Open leads"
          value={s.total_leads}
          sub={`${s.new_leads_week} new this week`}
          icon={Sparkle}
          testId="stat-leads"
        />
        <StatCard
          label="Attention items"
          value={s.attention_count}
          sub={s.attention_count === 0 ? "You're all caught up" : "Tap a card below"}
          icon={AlertCircle}
          highlight={s.attention_count > 0}
          testId="stat-attention"
        />
      </div>

      {/* Secondary KPI strip — money + momentum */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 cp-stagger">
        <StatCard
          label="Revenue this month"
          value={formatMoney(s.revenue_this_month)}
          sub={`${formatMoney(s.revenue_all_time)} all-time`}
          delta={monthDelta(s.revenue_this_month, s.revenue_last_month, formatMoney)}
          icon={Coins}
          tint="var(--cp-success)"
          testId="stat-rev-month"
        />
        <StatCard
          label="Outstanding dues"
          value={formatMoney(s.total_outstanding)}
          sub={s.total_outstanding > 0 ? "Ages off balance, not silence" : "Nothing pending"}
          icon={Wallet}
          tint={s.total_outstanding > 0 ? "var(--cp-accent)" : undefined}
          testId="stat-outstanding"
        />
        <StatCard
          label="Won this month"
          value={s.signed_this_month}
          sub="Signed conversions"
          delta={monthDelta(s.signed_this_month, s.signed_last_month, (v) => `${v}`)}
          icon={CheckCircle2}
          tint="var(--cp-success)"
          testId="stat-won"
        />
        <StatCard
          label="Contacted this week"
          value={`${s.contacted_this_week}/${s.total_clients}`}
          sub={`${s.contacted_today} in the last 24h`}
          icon={Activity}
          sparkline={s.contacts_daily}
          testId="stat-contacted"
        />
      </div>

      {/* Rescued strip — proof-of-value */}
      {typeof s.relationships_rescued === "number" && (
        <div
          className="cp-card mb-8 px-5 py-4 flex items-center gap-3 flex-wrap"
          data-testid="stat-rescued"
          style={{
            background:
              "linear-gradient(135deg, var(--cp-accent-surface), rgba(74,114,86,0.06))",
            borderColor: "rgba(192,87,70,0.25)",
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-[color:var(--cp-accent)]/12 text-[color:var(--cp-accent)] flex items-center justify-center">
            <HeartHandshake size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] text-[color:var(--cp-text)]">
              <span className="font-semibold text-[color:var(--cp-accent)]">{s.relationships_rescued}</span>{" "}
              {s.relationships_rescued === 1 ? "relationship" : "relationships"} rescued in the last 7 days —
              clients who were silent, then heard from you.
            </div>
          </div>
          <Link to="/analytics" className="cp-btn-ghost text-[13px] shrink-0" data-testid="link-rescued-analytics">
            See analytics <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Pipeline breakdown */}
      {data.pipeline_by_stage && data.pipeline_by_stage.length > 0 && (
        <div className="cp-card p-5 md:p-6 mb-8" data-testid="pipeline-breakdown">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="text-[15px] font-semibold">Pipeline at a glance</div>
              <div className="text-[12px] text-[color:var(--cp-text-3)] mt-0.5">
                How your clients are distributed across every stage — click any bar to jump to the list.
              </div>
            </div>
            <Link to="/clients" className="cp-btn-ghost text-[13px]" data-testid="link-all-clients">
              View all clients <ArrowRight size={14} />
            </Link>
          </div>
          <PipelineBars data={data.pipeline_by_stage} />
        </div>
      )}

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
                    {formatMoney(it.outstanding)} pending · unpaid for {it.outstanding_days ?? 0} days · {formatMoney(it.paid)} received of {formatMoney(it.quoted)}
                  </div>
                </div>
                <ActionButtons item={it} onWa={() => openWa(it, "payment_reminder", { amount: it.outstanding })} />
              </Row>
            ))}
          </CardSection>
        )}

        {data.reengagement_ready && data.reengagement_ready.length > 0 && (
          <CardSection
            title="Ready for re-engagement"
            count={data.reengagement_ready.length}
            icon={Repeat2}
            tint={{ bg: "rgba(138,96,70,0.12)", fg: "#8A6046" }}
          >
            {data.reengagement_ready.map((it) => (
              <Row key={it.client_id} testId={`row-reengagement-${it.client_id}`}>
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

const StatCard = ({ label, value, sub, icon: Icon, highlight, tint, delta, sparkline, testId }) => (
  <div
    className={`cp-card p-4 md:p-5 relative overflow-hidden ${highlight ? "ring-1 ring-[color:var(--cp-accent)]/30" : ""}`}
    data-testid={testId}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="text-[11px] uppercase tracking-widest text-[color:var(--cp-text-3)]">{label}</div>
      {Icon && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: tint ? `${tint}15` : "var(--cp-subtle)",
            color: tint || "var(--cp-text-2)",
          }}
        >
          <Icon size={14} strokeWidth={2.1} />
        </div>
      )}
    </div>
    <div
      className={`mt-2 text-2xl md:text-3xl font-semibold tracking-tight ${highlight ? "text-[color:var(--cp-accent)]" : ""}`}
      style={!highlight && tint ? { color: tint } : {}}
    >
      {value}
    </div>
    {delta && (
      <div
        className={`mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium ${delta.up ? "text-[color:var(--cp-success)]" : "text-[color:var(--cp-accent)]"}`}
        data-testid={`${testId}-delta`}
      >
        {delta.label}
      </div>
    )}
    {sub && !delta && (
      <div className="mt-1 text-[12px] text-[color:var(--cp-text-3)]">{sub}</div>
    )}
    {delta && sub && (
      <div className="mt-0.5 text-[11px] text-[color:var(--cp-text-3)]">{sub}</div>
    )}
    {sparkline && sparkline.length > 0 && (
      <div className="mt-2" data-testid={`${testId}-sparkline`}>
        <Sparkline values={sparkline} />
      </div>
    )}
  </div>
);

const Sparkline = ({ values }) => {
  const max = Math.max(1, ...values);
  const bars = values.length;
  return (
    <div className="flex items-end gap-[3px] h-8">
      {values.map((v, i) => {
        const h = Math.max(6, (v / max) * 100);
        const isToday = i === bars - 1;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm transition-colors"
            style={{
              height: `${h}%`,
              background: isToday ? "var(--cp-accent)" : "rgba(192,87,70,0.35)",
            }}
            title={`${v} interaction${v === 1 ? "" : "s"}`}
          />
        );
      })}
    </div>
  );
};

const PipelineBars = ({ data }) => {
  const total = Math.max(1, data.reduce((a, b) => a + b.count, 0));
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2.5" data-testid="pipeline-bars">
      {data.map((row) => {
        const pct = Math.round((row.count / total) * 100);
        const barPct = Math.max(4, (row.count / maxCount) * 100);
        return (
          <Link
            key={row.stage}
            to={`/clients?stage=${encodeURIComponent(row.stage)}`}
            className="flex items-center gap-3 group"
            data-testid={`pipeline-row-${row.stage}`}
          >
            <div className="w-28 md:w-32 shrink-0">
              <span className={`cp-stage-pill ${stageClass(row.stage)}`}>{row.stage}</span>
            </div>
            <div className="flex-1 relative h-8 bg-[color:var(--cp-subtle)] rounded-lg overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-lg transition-all group-hover:brightness-95"
                style={{
                  width: `${barPct}%`,
                  background: STAGE_BAR_COLOR[row.stage] || "var(--cp-accent)",
                  opacity: row.count === 0 ? 0.15 : 1,
                }}
              />
              <div className="absolute inset-0 flex items-center px-3 text-[12px] font-medium">
                <span className="text-white mix-blend-difference">{row.count} {row.count === 1 ? "client" : "clients"}</span>
                <span className="ml-auto text-[color:var(--cp-text-2)] text-[11px]">
                  {formatMoney(row.value)} · {pct}%
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

const STAGE_BAR_COLOR = {
  Lead: "#B47530",       // warm amber (was blue-gray)
  Pitched: "#94682F",
  Negotiating: "#D48C45",
  Signed: "#4A7256",
  "In Progress": "#C05746",
  Delivered: "#8A6046",
  Past: "#B5B0A6",
};

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
