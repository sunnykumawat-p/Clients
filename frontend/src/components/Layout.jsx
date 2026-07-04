import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, MessageSquareText, BarChart3, Settings, LogOut, Sparkles } from "lucide-react";
import Footer from "@/components/Footer";

const items = [
  { to: "/", label: "Today", icon: LayoutDashboard, testId: "nav-dashboard", end: true },
  { to: "/clients", label: "Clients", icon: Users, testId: "nav-clients" },
  { to: "/templates", label: "Templates", icon: MessageSquareText, testId: "nav-templates" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testId: "nav-analytics" },
  { to: "/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();

  return (
    <div className="min-h-screen flex bg-[color:var(--cp-bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r border-[color:var(--cp-border)] bg-[color:var(--cp-bg)] cp-grain">
        <div className="px-6 pt-7 pb-6">
          <Link to="/" className="flex items-center gap-2.5" data-testid="brand-logo">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--cp-accent)] flex items-center justify-center text-white">
              <Sparkles size={18} strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">ClientPulse</div>
              <div className="text-[11px] text-[color:var(--cp-text-3)]">Relationship-first CRM</div>
            </div>
          </Link>
        </div>
        <nav className="px-3 flex-1 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={it.testId}
              className={({ isActive }) => `cp-nav-link ${isActive ? "active" : ""}`}
            >
              <it.icon size={17} strokeWidth={2} />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 pb-5 space-y-3">
          <div className="cp-card p-3">
            <div className="text-[11px] text-[color:var(--cp-text-3)] uppercase tracking-wider">Signed in as</div>
            <div className="text-sm font-medium mt-0.5">{user?.name || "Owner"}</div>
            <div className="text-[12px] text-[color:var(--cp-text-2)] truncate">{user?.email}</div>
            <button
              onClick={logout}
              data-testid="btn-logout"
              className="mt-3 flex items-center gap-2 text-[13px] text-[color:var(--cp-text-2)] hover:text-[color:var(--cp-accent)] transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
          <div className="text-center">
            <div className="font-signature text-[color:var(--cp-accent)] text-base">
              Made by Raj with Love using Emergent
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-[color:var(--cp-bg)]/95 backdrop-blur border-b border-[color:var(--cp-border)] px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo-mobile">
            <div className="w-8 h-8 rounded-lg bg-[color:var(--cp-accent)] flex items-center justify-center text-white">
              <Sparkles size={15} />
            </div>
            <div className="text-[15px] font-semibold">ClientPulse</div>
          </Link>
          <button onClick={logout} data-testid="btn-logout-mobile" className="cp-btn-ghost">
            <LogOut size={16} />
          </button>
        </div>

        <main key={loc.pathname} className="flex-1 pb-24 md:pb-8 cp-fade-in">
          <Outlet />
        </main>

        <Footer />

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[color:var(--cp-border)] flex items-center pb-safe z-40">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={`m-${it.testId}`}
              className={({ isActive }) => `cp-mobile-nav-link ${isActive ? "active" : ""}`}
            >
              <it.icon size={20} strokeWidth={2} />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
