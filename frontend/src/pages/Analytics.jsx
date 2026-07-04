import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatMoney } from "@/lib/cp";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";

const STAGE_COLORS = {
  Lead: "#4A6E82",
  Pitched: "#94682F",
  Negotiating: "#D48C45",
  Signed: "#4A7256",
  "In Progress": "#C05746",
  Delivered: "#8A6046",
  Past: "#9A9791",
};

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
                  <Cell key={i} fill={["#C05746", "#4A7256", "#D48C45", "#4A6E82", "#8A6046", "#94682F", "#9A9791"][i % 7]} />
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
