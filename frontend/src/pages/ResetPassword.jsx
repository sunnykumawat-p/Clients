import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Lock, KeyRound } from "lucide-react";
import api from "@/lib/api";
import AuthShell from "@/components/AuthShell";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [token, setToken] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      toast.success("Password updated. Sign in with your new password.");
      setTimeout(() => nav("/login"), 1500);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Reset failed";
      toast.error(typeof msg === "string" ? msg : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Reset password"
      title={done ? "Password updated" : "Set a new password"}
      subtitle={done ? "Redirecting you to sign in…" : "Enter a new password for your ClientPulse account."}
      footer={
        <div className="text-center text-[13.5px] text-[color:var(--cp-text-2)]">
          <Link to="/login" className="text-[color:var(--cp-accent)] hover:underline font-medium" data-testid="link-back-login-2">
            Back to sign in
          </Link>
        </div>
      }
    >
      {!done && (
        <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
          <div>
            <label className="cp-label">Reset token</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)]" />
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="cp-input pl-9 font-mono text-[12px]"
                data-testid="reset-token"
                placeholder="Paste token from reset link"
              />
            </div>
          </div>
          <div>
            <label className="cp-label">New password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cp-input pl-9"
                placeholder="At least 6 chars"
                data-testid="reset-password"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <label className="cp-label">Confirm new password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)]" />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="cp-input pl-9"
                placeholder="Repeat"
                data-testid="reset-confirm"
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cp-btn-primary w-full text-base"
            data-testid="reset-submit"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
