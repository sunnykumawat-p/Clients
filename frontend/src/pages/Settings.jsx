import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LifeBuoy, Save, Info } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setForm(r.data));
  }, []);

  if (!form) return <div className="p-8 text-[color:var(--cp-text-3)]">Loading settings…</div>;

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", {
        follow_up_lead_days: Number(form.follow_up_lead_days),
        quiet_active_days: Number(form.quiet_active_days),
        stages: form.stages,
        business_name: form.business_name,
        owner_name: form.owner_name,
      });
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  };

  const updateStage = (i, val) => {
    const next = [...form.stages];
    next[i] = val;
    setForm({ ...form, stages: next });
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-3xl mx-auto space-y-5">
      <div>
        <div className="text-xs uppercase tracking-widest text-[color:var(--cp-text-3)]">Settings</div>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">Tune ClientPulse</h1>
        <p className="mt-1.5 text-[color:var(--cp-text-2)]">Adjust attention thresholds, stages, and workspace details.</p>
      </div>

      <div className="cp-card p-5 md:p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="cp-label">Business name</label>
            <input
              className="cp-input"
              value={form.business_name || ""}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              data-testid="settings-business-name"
            />
          </div>
          <div>
            <label className="cp-label">Owner name</label>
            <input
              className="cp-input"
              value={form.owner_name || ""}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              data-testid="settings-owner-name"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="cp-label">Follow-up threshold for Leads (days)</label>
            <input
              type="number"
              min="1"
              className="cp-input"
              value={form.follow_up_lead_days}
              onChange={(e) => setForm({ ...form, follow_up_lead_days: e.target.value })}
              data-testid="settings-followup-days"
            />
            <div className="text-[12px] text-[color:var(--cp-text-3)] mt-1">
              Leads with no logged activity in this many days show up in Today.
            </div>
          </div>
          <div>
            <label className="cp-label">&quot;Going quiet&quot; threshold for active clients (days)</label>
            <input
              type="number"
              min="1"
              className="cp-input"
              value={form.quiet_active_days}
              onChange={(e) => setForm({ ...form, quiet_active_days: e.target.value })}
              data-testid="settings-quiet-days"
            />
            <div className="text-[12px] text-[color:var(--cp-text-3)] mt-1">
              Signed / In Progress clients silent for this long are flagged.
            </div>
          </div>
        </div>

        <div>
          <label className="cp-label">Pipeline stages</label>
          <div className="space-y-2">
            {form.stages.map((s, i) => (
              <input
                key={i}
                className="cp-input"
                value={s}
                onChange={(e) => updateStage(i, e.target.value)}
                data-testid={`settings-stage-${i}`}
              />
            ))}
          </div>
          <div className="text-[12px] text-[color:var(--cp-text-3)] mt-2">
            Rename to match your workflow. Order defines the funnel top → bottom.
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="cp-btn-primary" data-testid="settings-save">
            <Save size={16} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="cp-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-[color:var(--cp-text-3)]" />
          <div className="font-medium">Signed in</div>
        </div>
        <div className="text-[13px] text-[color:var(--cp-text-2)]">
          <div>Email: <span className="text-[color:var(--cp-text)]">{user?.email}</span></div>
          <div>Owner: <span className="text-[color:var(--cp-text)]">{user?.name}</span></div>
        </div>
        <button onClick={logout} className="cp-btn-secondary mt-4 text-[13px]" data-testid="settings-logout">
          Sign out
        </button>
      </div>

      <div className="cp-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <LifeBuoy size={16} className="text-[color:var(--cp-accent)]" />
          <div className="font-medium">Support</div>
        </div>
        <div className="text-[13.5px] text-[color:var(--cp-text-2)] leading-relaxed">
          Facing any glitch or need help? Write to{" "}
          <a href="mailto:Sunnykumawat321@gmail.com" className="text-[color:var(--cp-accent)] hover:underline" data-testid="settings-support-email">
            Sunnykumawat321@gmail.com
          </a>{" "}
          and we&apos;ll get back within a working day.
        </div>
      </div>
    </div>
  );
}
