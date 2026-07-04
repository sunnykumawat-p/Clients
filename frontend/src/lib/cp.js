export const STAGES = [
  "Lead",
  "Pitched",
  "Negotiating",
  "Signed",
  "In Progress",
  "Delivered",
  "Past",
];

export const stageClass = (stage) => {
  const map = {
    Lead: "stage-lead",
    Pitched: "stage-pitched",
    Negotiating: "stage-negotiating",
    Signed: "stage-signed",
    "In Progress": "stage-in-progress",
    Delivered: "stage-delivered",
    Past: "stage-past",
  };
  return map[stage] || "stage-lead";
};

export const SOURCES = [
  "Referral",
  "Cold Outreach",
  "Instagram",
  "LinkedIn",
  "Walk-in",
  "Website",
  "Other",
];

export const formatMoney = (n) => {
  if (!n && n !== 0) return "₹0";
  const val = Math.round(Number(n));
  return "₹" + val.toLocaleString("en-IN");
};

export const daysAgo = (iso) => {
  if (!iso) return 0;
  const d = new Date(iso);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

// Build wa.me deep link
export const buildWaLink = (phone, message) => {
  const clean = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message || "")}`;
};

// Fill template placeholders
export const fillTemplate = (body, ctx = {}) => {
  return (body || "")
    .replace(/\{name\}/g, ctx.name || "")
    .replace(/\{amount\}/g, ctx.amount != null ? Math.round(ctx.amount).toLocaleString("en-IN") : "")
    .replace(/\{stage\}/g, ctx.stage || "")
    .replace(/\{milestone\}/g, ctx.milestone || "the milestone");
};

// Pick a template from a list matching category + language
export const pickTemplate = (templates, category, language) => {
  if (!templates) return null;
  return (
    templates.find((t) => t.category === category && t.language === language) ||
    templates.find((t) => t.category === category) ||
    null
  );
};
