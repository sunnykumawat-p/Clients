import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatMoney } from "@/lib/cp";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { Sparkles } from "lucide-react";

const STAGE_COLORS = {
  Lead: "#B47530",       // warm amber (was blue-gray — replaced)
  Pitched: "#94682F",    // sandy tan
  Negotiating: "#D48C45", // warm gold
  Signed: "#4A7256",     // olive green
  "In Progress": "#C05746", // terracotta
  Delivered: "#8A6046",   // muted brown
  Past: "#9A9791",       // stone gray
};

// Warm-only rotation used for source donut & other categorical charts.
// Explicitly no blue, purple, or teal.
const WARM_ROTATION = [
  "#C05746", // terracotta
  "#4A7256", // olive
  "#D48C45", // warm gold
  "#B47530", // amber
  "#8A6046", // brown
  "#94682F", // sandy tan
  "#9A9791", // stone gray
];

export default function Analytics() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/analytics/summary").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="p-8 text-[color:var(--cp-text-3)]">Loading analytics…</div>;

  const stageData = Object.entries(data.by_stage).map(([name, value]) => ({ name, value }));
  const sourceData = Object.entries(data.by_source).map(([name, value]) => ({ name, value }));
  const convSource = Object.entries(data.conversion_by_source).map(([name, value]) => ({ name, value }));

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-[color:var(--cp-text-3)]">Analytics</div>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">Where your business stands</h1>
        <p className="mt-1.5 text-[color:var(--cp-text-2)] text-[15px]">
          One glance at pipeline, revenue, and where clients are converting from.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 cp-stagger">
        <Kpi label="Active clients" value={data.totals.active_clients} testId="kpi-active" />
        <Kpi label="Pipeline value" value={formatMoney(data.totals.pipeline_value)} testId="kpi-pipeline" />
        <Kpi label="Revenue this month" value={formatMoney(data.totals.revenue_month)} testId="kpi-rev-month" />
        <Kpi label="Total revenue" value={formatMoney(data.totals.revenue_all)} testId="kpi-rev-all" />
        <Kpi label="Total clients" value={data.totals.total_clients} testId="kpi-total" />
        <Kpi label="Avg Lead → Signed" value={`${data.totals.avg_lead_to_signed_days} days`} testId="kpi-avg-lead" />
      </div>

      {/* Relationships Rescued — the proof-of-value KPI */}
      <div
        className="cp-card p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 border-[color:var(--cp-accent)]/25"
        data-testid="kpi-rescued"
        style={{
          background:
            "linear-gradient(135deg, var(--cp-accent-surface), rgba(74,114,86,0.06))",
        }}
      >
        <div className="w-14 h-14 rounded-2xl bg-[color:var(--cp-accent)]/10 text-[color:var(--cp-accent)] flex items-center justify-center shrink-0">
          <Sparkles size={22} strokeWidth={2} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--cp-text-3)]">
            Relationships rescued · last {data.totals.rescue_window_days} days
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <div className="text-4xl font-semibold tracking-tight text-[color:var(--cp-accent)]">
              {data.totals.relationships_rescued}
            </div>
            <div className="text-[13.5px] text-[color:var(--cp-text-2)]">
              {data.totals.relationships_rescued === 1 ? "client was" : "clients were"} silent for{" "}
              {data.totals.rescue_threshold_days}+ days and got a message from you inside this window.
            </div>
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--cp-text-3)]">
            This is proof the tool changed an outcome — a real save, not a display metric.
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Clients by stage" testId="chart-stages">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stageData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6C6A65" }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#6C6A65" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EAE7E1" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {stageData.map((s) => (
                  <Cell key={s.name} fill={STAGE_COLORS[s.name] || "#C05746"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Clients by source" testId="chart-sources">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={WARM_ROTATION[i % WARM_ROTATION.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EAE7E1" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Conversion rate by source (%)" testId="chart-conv-source">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={convSource} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6C6A65" }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#6C6A65" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EAE7E1" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#4A7256" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Conversion by language" testId="chart-conv-lang">
          <div className="grid grid-cols-2 gap-4 py-4">
            {["en", "hi"].map((lang) => (
              <div key={lang} className="rounded-2xl border border-[color:var(--cp-border)] p-5 text-center">
                <div className="text-[11px] uppercase tracking-widest text-[color:var(--cp-text-3)]">
                  {lang === "en" ? "English" : "हिन्दी"}
                </div>
                <div className="mt-2 text-3xl font-semibold text-[color:var(--cp-accent)]">
                  {data.conversion_by_language[lang] || 0}%
                </div>
                <div className="text-[12px] text-[color:var(--cp-text-3)] mt-1">Lead → Signed+</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

const Kpi = ({ label, value, testId }) => (
  <div className="cp-card p-4 md:p-5" data-testid={testId}>
    <div className="text-[11px] uppercase tracking-widest text-[color:var(--cp-text-3)]">{label}</div>
    <div className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">{value}</div>
  </div>
);

const ChartCard = ({ title, children, testId }) => (
  <div className="cp-card p-5" data-testid={testId}>
    <div className="text-[14px] font-medium mb-2">{title}</div>
    {children}
  </div>
);
