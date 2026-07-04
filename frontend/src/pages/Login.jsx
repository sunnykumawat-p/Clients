import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Mail, Lock } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("owner@clientpulse.app");
  const [password, setPassword] = useState("pulse2026");
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
      const msg =
        err?.response?.data?.detail || err?.message || "Login failed";
      toast.error(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left — branding */}
      <div
        className="relative md:w-1/2 min-h-[220px] md:min-h-screen p-8 md:p-14 flex flex-col justify-between text-white overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(45,44,42,0.55), rgba(192,87,70,0.55)), url(https://images.pexels.com/photos/68498/pexels-photo-68498.jpeg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center text-[color:var(--cp-accent)]">
            <Sparkles size={20} />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-semibold tracking-tight">ClientPulse</div>
            <div className="text-[12px] text-white/80">Relationship-first CRM</div>
          </div>
        </div>

        <div className="hidden md:block max-w-md">
          <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
            Hold every client relationship in one calm place.
          </h1>
          <p className="mt-4 text-white/85 text-base leading-relaxed">
            Every call, every payment, every promise — remembered for you. Never
            reconstruct a client&apos;s history from old WhatsApp threads again.
          </p>
        </div>

        <div className="font-signature text-white/95 text-lg" data-testid="login-signature">
          Made by Raj with Love using Emergent
        </div>
      </div>

      {/* Right — form */}
      <div className="md:w-1/2 flex items-center justify-center p-6 md:p-14 bg-[color:var(--cp-bg)]">
        <form onSubmit={submit} className="w-full max-w-md space-y-6" data-testid="login-form">
          <div>
            <div className="text-xs uppercase tracking-widest text-[color:var(--cp-text-3)]">Owner sign-in</div>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-[color:var(--cp-text-2)]">
              Sign in to your single-owner ClientPulse workspace.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="cp-label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="cp-input pl-9"
                  data-testid="login-email"
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="cp-label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cp-text-3)]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="cp-input pl-9"
                  data-testid="login-password"
                  autoComplete="current-password"
                />
              </div>
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

          <div className="text-center text-[12px] text-[color:var(--cp-text-3)]">
            Trouble signing in? Write to{" "}
            <a
              className="text-[color:var(--cp-accent)] hover:underline"
              href="mailto:Sunnykumawat321@gmail.com"
              data-testid="login-support-email"
            >
              Sunnykumawat321@gmail.com
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
