import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Copy, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import AuthShell from "@/components/AuthShell";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { reset_path, expires_in_minutes } or generic

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setResult(data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Something went wrong";
      toast.error(typeof msg === "string" ? msg : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const full = window.location.origin + result.reset_path;
    navigator.clipboard.writeText(full);
    toast.success("Reset link copied");
  };

  return (
    <AuthShell
      eyebrow="Forgot password"
      title="Reset your password"
      subtitle="Enter your email and we'll generate a reset link."
      footer={
        <div className="text-center text-[13.5px] text-[color:var(--cp-text-2)]">
          Remembered it?{" "}
          <Link to="/login" className="text-[color:var(--cp-accent)] hover:underline font-medium" data-testid="link-back-login">
            Back to sign in
          </Link>
        </div>
      }
    >
      {!result || !result.reset_path ? (
        <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
          <div>
            <label className="cp-label">Your email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cp-input pl-9"
                placeholder="you@company.com"
                data-testid="forgot-email"
                autoComplete="email"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="cp-btn-primary w-full text-base"
            data-testid="forgot-submit"
          >
            {loading ? "Generating…" : "Send reset link"}
          </button>
          {result && !result.reset_path && (
            <div className="cp-card p-4 bg-[color:var(--cp-subtle)] text-[13px] text-[color:var(--cp-text-2)]" data-testid="forgot-generic">
              If an account exists for {email}, a reset link has been generated.
            </div>
          )}
        </form>
      ) : (
        <div className="space-y-4" data-testid="forgot-result">
          <div className="cp-card p-4 bg-[color:var(--cp-success)]/5 border-[color:var(--cp-success)]/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-[color:var(--cp-success)] shrink-0 mt-0.5" />
              <div className="text-[13.5px] text-[color:var(--cp-text)] leading-relaxed">
                <div className="font-medium">Reset link generated</div>
                <div className="text-[color:var(--cp-text-2)] mt-1">
                  In production this would be emailed to you. For this workspace, use the link below (valid for {result.expires_in_minutes} minutes).
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="cp-label">Your reset link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={window.location.origin + result.reset_path}
                className="cp-input font-mono text-[12px]"
                data-testid="forgot-reset-link"
                onFocus={(e) => e.target.select()}
              />
              <button onClick={copyLink} className="cp-btn-secondary shrink-0" data-testid="forgot-copy">
                <Copy size={15} />
              </button>
            </div>
          </div>

          <Link
            to={result.reset_path}
            className="cp-btn-primary w-full text-base"
            data-testid="forgot-open-reset"
          >
            Open reset page
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
