import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./app/App";
import { StatusBadge } from "./components/ui/StatusBadge";
import { PauseAndPlanGate } from "./features/pause-plan/PauseAndPlanGate";
import { AutopsyProvider } from "./features/workflow/AutopsyContext";
import { CORE_PRODUCT_RULE, MANDATORY_DISCLAIMER } from "./lib/constants";

// Stub WebGL2 background in jsdom tests while keeping DashBoardBackground.jsx untouched
vi.mock("./components/DashBoardBackground", () => ({
  default: () => <div data-testid="wayglim-bg-stub" aria-hidden="true" />,
}));

function renderRoute(initialEntry: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AutopsyProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppRoutes />
        </MemoryRouter>
      </AutopsyProvider>
    </QueryClientProvider>
  );
}

describe("Tip Autopsy Phase 1 & 2 Frontend Guardrails", () => {
  it("renders the hero composition matching ui-ux/hero.jpeg with 5 creator panels and non-advisory framing", () => {
    renderRoute("/");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Think Before You Trust.");
    expect(screen.getByRole("button", { name: /Analyze a Tip/i })).toBeInTheDocument();
    expect(screen.getByText(CORE_PRODUCT_RULE)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(MANDATORY_DISCLAIMER.replace(".", "\\.")))).toBeInTheDocument();
    expect(screen.getAllByAltText(/Illustrative finfluencer/i).length).toBeGreaterThanOrEqual(5);
  });

  it("renders the compliant frosted dashboard shell without prohibited mockup labels", async () => {
    renderRoute("/dashboard");

    expect(await screen.findByText("Dated Market Snapshots · NSE / BSE")).toBeInTheDocument();
    expect(screen.getByTestId("wayglim-bg-stub")).toBeInTheDocument();
    expect(screen.getByText(CORE_PRODUCT_RULE)).toBeInTheDocument();
    expect(screen.getByText(MANDATORY_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText("NIFTY 50")).toBeInTheDocument();
    expect(screen.getByText("SENSEX")).toBeInTheDocument();
    expect(screen.getByText("BANKNIFTY")).toBeInTheDocument();

    expect(screen.queryByText(/Live Market Data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidence Score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Past Reports/i)).not.toBeInTheDocument();

    // Verify docked StickyBubblyNav notch renders in resting state and expands on hover/click
    const notchNav = screen.getByTestId("sticky-bubbly-nav");
    expect(notchNav).toBeInTheDocument();
    fireEvent.mouseEnter(notchNav);
    expect(screen.getByRole("menuitem", { name: "Analyze Tip" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Pretend Money" })).toBeInTheDocument();
  });

  it("renders explicit status text on neutral evidence badges", () => {
    render(
      <div>
        <StatusBadge tone="neutral_ok" label="Within normal range" />
        <StatusBadge tone="attention" label="Needs attention" />
        <StatusBadge tone="unverified" label="Could not verify" />
      </div>
    );

    expect(screen.getByText("Within normal range")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Could not verify")).toBeInTheDocument();
  });

  it("gates Pause & Plan until all three questions are answered and never writes to browser storage", () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <AutopsyProvider>
        <PauseAndPlanGate />
      </AutopsyProvider>
    );

    const submitBtn = screen.getByRole("button", { name: /I'd act on this/i });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/How much can I afford to lose/i), {
      target: { value: "₹5,000" },
    });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/At what price do I exit/i), {
      target: { value: "₹580 stop" },
    });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/What would prove this tip wrong/i), {
      target: { value: "Volume collapses and closes below prior support" },
    });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);
    expect(screen.getByText(/Personal pre-commitment review completed/i)).toBeInTheDocument();

    // Strict privacy invariant: zero browser storage writes
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });
});
