import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  BookOpenText,
  ChartLineUp,
  FilmStrip,
  List,
  LockSimple,
  MagnifyingGlass,
  ShieldCheck,
  SquaresFour,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import DashBoardBackground from "../components/DashBoardBackground";
import { BrandMark } from "../components/ui/BrandMark";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { CORE_PRODUCT_RULE } from "../lib/constants";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: SquaresFour, end: true },
  { to: "/analyze", label: "New Analysis", icon: MagnifyingGlass, end: false },
  { to: "/stocks", label: "Real-Time Stocks", icon: ChartLineUp, end: false },
  { to: "/finfluencers", label: "Finfluencers", icon: UsersThree, end: false },
  { to: "/corpus", label: "Demo Corpus", icon: FilmStrip, end: false },
  { to: "/how-it-works", label: "How Checks Work", icon: BookOpenText, end: false },
] as const;

export function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="relative isolate h-[100dvh] w-full overflow-hidden bg-[#F3EFE7] p-2 sm:p-4 lg:p-5">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-[#161A18] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-[#FAF8F4]"
      >
        Skip to main content
      </a>
      {/* Verbatim Wayglim WebGL2 animated gradient background from ui-ux/DashBoardBackground.jsx */}
      <DashBoardBackground />

      {/* Single-Window Frosted Glass Dashboard Shell (internal scrolling per workspace page) */}
      <div className="glass-shell relative z-10 mx-auto flex h-full w-full max-w-[1380px] flex-col overflow-hidden rounded-[20px] sm:rounded-[24px] lg:flex-row">
        {/* Mobile Top Bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-[rgba(22,26,24,0.08)] bg-white/65 px-4 py-2.5 lg:hidden">
          <Link to="/" className="rounded-xl">
            <BrandMark />
          </Link>
          <button
            type="button"
            aria-label={drawerOpen ? "Close navigation drawer" : "Open navigation drawer"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(22,26,24,0.09)] bg-white/80 text-[#161A18]"
          >
            {drawerOpen ? <X size={20} weight="regular" /> : <List size={20} weight="regular" />}
          </button>
        </header>

        {/* Mobile Slide-Down Nav Drawer */}
        {drawerOpen && (
          <nav
            aria-label="Workspace navigation mobile"
            className="flex shrink-0 flex-col gap-1 border-b border-[rgba(22,26,24,0.08)] bg-white/92 p-3 lg:hidden"
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex h-10 items-center gap-3 rounded-xl px-3.5 text-[14px] font-medium transition-colors ${
                    isActive
                      ? "bg-[#E6F2EC] font-semibold text-[#1F4D3A]"
                      : "text-[#4A524D] hover:bg-black/5 hover:text-[#161A18]"
                  }`
                }
              >
                <Icon size={18} weight="regular" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        {/* Desktop Fixed Frosted Left Sidebar Rail (always fits within single window) */}
        <aside className="hidden h-full w-[236px] shrink-0 flex-col justify-between overflow-y-auto border-r border-[rgba(22,26,24,0.08)] bg-[rgba(255,255,255,0.46)] p-4 xl:p-5 lg:flex">
          <div className="space-y-5">
            <Link to="/" className="inline-flex rounded-xl">
              <BrandMark />
            </Link>

            <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex h-10 items-center gap-3 rounded-xl px-3.5 text-[14px] transition-all ${
                      isActive
                        ? "border border-[rgba(22,26,24,0.07)] bg-white/92 font-semibold text-[#161A18] shadow-[0_4px_14px_rgba(22,26,24,0.06)]"
                        : "font-medium text-[#4A524D] hover:bg-white/55 hover:text-[#161A18]"
                    }`
                  }
                >
                  <Icon size={18} weight="regular" aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="space-y-2.5 pt-4">
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(22,26,24,0.08)] bg-white/65 px-3 py-2 text-[11.5px] font-medium text-[#4A524D]">
              <LockSimple
                size={14}
                weight="duotone"
                className="shrink-0 text-[#4A7C64]"
                aria-hidden="true"
              />
              <span>No login · Opt-in alerts only</span>
            </div>

            <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-white/60 px-3 py-2 text-[11px] leading-relaxed text-[#6E7771]">
              <p className="m-0 font-semibold text-[#4A524D]">Provenance Legend</p>
              <p className="mt-0.5 mb-0">
                <strong className="text-[#1F4D3A]">Real · Live / Snapshot</strong> = NSE/BSE, SEBI, or YouTube RSS.{" "}
                <strong className="text-[#4A524D]">Mixed/Demo</strong> = curated tips.
              </p>
            </div>

            <div className="rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/80 p-3.5 shadow-[0_4px_16px_-2px_rgba(22,26,24,0.05)]">
              <ShieldCheck size={20} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
              <p className="mt-2 mb-0 text-[12.5px] leading-[1.4] font-medium text-[#161A18]">
                {CORE_PRODUCT_RULE}
              </p>
            </div>
          </div>
        </aside>

        {/* Fluid Main Column: internal scrolling content area + pinned compact disclaimer */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 lg:p-6"
          >
            <Outlet />
          </main>

          <div className="shrink-0 border-t border-[rgba(22,26,24,0.08)] bg-[rgba(250,248,244,0.72)] px-4 py-2.5 sm:px-5 lg:px-6">
            <DisclaimerBanner />
          </div>
        </div>
      </div>
    </div>
  );
}
