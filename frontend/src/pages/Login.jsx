import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AuthShell from "@/components/AuthShell";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      nav("/", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Login failed";
      toast.error(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Sign in to your ClientPulse workspace."
      footer={
        <div className="text-center text-[13.5px] text-[color:var(--cp-text-2)]">
          New here?{" "}
          <Link to="/signup" className="text-[color:var(--cp-accent)] hover:underline font-medium" data-testid="link-to-signup">
            Create your workspace
          </Link>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div>
          <label className="cp-label">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)] pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="cp-input pl-11"
              placeholder="you@company.com"
              data-testid="login-email"
              autoComplete="email"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="cp-label">Password</label>
            <Link to="/forgot-password" className="text-[12px] text-[color:var(--cp-accent)] hover:underline" data-testid="link-to-forgot">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)] pointer-events-none" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="cp-input pl-11"
              placeholder="••••••••"
              data-testid="login-password"
              autoComplete="current-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="cp-btn-primary w-full text-base"
          data-testid="login-submit"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
