import { Outlet } from "react-router-dom";
import { ShieldCheck } from "@phosphor-icons/react";
import DashBoardBackground from "../components/DashBoardBackground";
import { StickyBubblyNav } from "../components/StickyBubblyNav";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { CORE_PRODUCT_RULE } from "../lib/constants";

export function DashboardLayout() {
  return (
    <div className="relative isolate flex h-[100dvh] w-full flex-col gap-2 overflow-hidden bg-[#F3EFE7] px-2 pt-2.5 pb-2 sm:gap-2.5 sm:px-4 sm:pt-3.5 sm:pb-2.5 lg:px-5 lg:pt-4 lg:pb-3">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-[#161A18] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-[#FAF8F4]"
      >
        Skip to main content
      </a>
      {/* Verbatim Wayglim WebGL2 animated gradient background from ui-ux/DashBoardBackground.jsx */}
      <DashBoardBackground />

      {/* Full-Width Single-Window Frosted Glass Dashboard Shell (flex-1 adjusts height automatically) */}
      <div className="glass-shell relative z-10 mx-auto flex min-h-0 w-full max-w-[1380px] flex-1 flex-col overflow-hidden rounded-[20px] sm:rounded-[24px]">
        {/* Fluid Main Column: internal scrolling content area + pinned compact disclaimer */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main
            id="main-content"
            tabIndex={-1}
            className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 lg:p-6"
          >
            <Outlet />
          </main>

          <div className="flex shrink-0 flex-col gap-2 border-t border-[rgba(22,26,24,0.08)] bg-[rgba(250,248,244,0.72)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(22,26,24,0.08)] bg-white/80 px-3 py-1 text-[12px] font-medium text-[#161A18]">
              <ShieldCheck size={15} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
              <span>{CORE_PRODUCT_RULE}</span>
            </div>
            <DisclaimerBanner />
          </div>
        </div>
      </div>

      {/* Dedicated Bottom Row Below the Main Dashboard for Sticky Bubbly Notch Dock */}
      <StickyBubblyNav />
    </div>
  );
}
