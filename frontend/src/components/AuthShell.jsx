import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

// Shared branding shell for auth pages (login / signup / forgot / reset)
export default function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div
        className="relative md:w-1/2 min-h-[180px] md:min-h-screen p-8 md:p-14 flex flex-col justify-between text-white overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(45,44,42,0.55), rgba(192,87,70,0.55)), url(https://images.pexels.com/photos/68498/pexels-photo-68498.jpeg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <Link to="/login" className="flex items-center gap-2.5" data-testid="auth-brand">
          <div className="w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center text-[color:var(--cp-accent)]">
            <Sparkles size={20} />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-semibold tracking-tight">ClientPulse</div>
            <div className="text-[12px] text-white/80">Client Memory Studio</div>
          </div>
        </Link>

        <div className="hidden md:block max-w-md">
          <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
            Hold every client relationship in one calm place.
          </h1>
          <p className="mt-4 text-white/85 text-base leading-relaxed">
            Every call, every payment, every promise — remembered for you.
          </p>
        </div>

        <div className="font-signature text-white/95 text-lg" data-testid="auth-signature">
          Made by Raj with Love❤️ using Emergent
        </div>
      </div>

      <div className="md:w-1/2 flex items-center justify-center p-6 md:p-14 bg-[color:var(--cp-bg)]">
        <div className="w-full max-w-md space-y-6">
          <div>
            {eyebrow && (
              <div className="text-xs uppercase tracking-widest text-[color:var(--cp-text-3)]">{eyebrow}</div>
            )}
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-2 text-[color:var(--cp-text-2)]">{subtitle}</p>}
          </div>

          {children}

          {footer}

          <div className="text-center text-[12px] text-[color:var(--cp-text-3)]">
            Trouble signing in? Write to{" "}
            <a
              className="text-[color:var(--cp-accent)] hover:underline"
              href="mailto:Sunnykumawat321@gmail.com"
              data-testid="auth-support-email"
            >
              Sunnykumawat321@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
