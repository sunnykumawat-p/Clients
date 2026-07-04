import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AuthShell from "@/components/AuthShell";

export default function Signup() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

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
      await register(name, email, password);
      toast.success("Welcome to ClientPulse");
      nav("/", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Sign up failed";
      toast.error(typeof msg === "string" ? msg : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Sign up"
      title="Create your workspace"
      subtitle="Start remembering every client, every conversation, in one place."
      footer={
        <div className="text-center text-[13.5px] text-[color:var(--cp-text-2)]">
          Already have an account?{" "}
          <Link to="/login" className="text-[color:var(--cp-accent)] hover:underline font-medium" data-testid="link-to-login">
            Sign in
          </Link>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <div>
          <label className="cp-label">Your name</label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)] pointer-events-none" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cp-input pl-11"
              placeholder="e.g. Raj"
              data-testid="signup-name"
              autoComplete="name"
            />
          </div>
        </div>
        <div>
          <label className="cp-label">Work email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)] pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="cp-input pl-11"
              placeholder="you@company.com"
              data-testid="signup-email"
              autoComplete="email"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cp-label">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)] pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cp-input pl-11"
                placeholder="6+ chars"
                data-testid="signup-password"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <label className="cp-label">Confirm</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)] pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="cp-input pl-11"
                placeholder="Repeat"
                data-testid="signup-confirm"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="cp-btn-primary w-full text-base"
          data-testid="signup-submit"
        >
          {loading ? "Creating your workspace…" : "Create workspace"}
        </button>

        <div className="text-[11px] text-[color:var(--cp-text-3)] text-center">
          By continuing you agree to keep your client data safe on your side.
        </div>
      </form>
    </AuthShell>
  );
}
