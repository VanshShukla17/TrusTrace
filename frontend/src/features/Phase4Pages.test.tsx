import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinfluencersPage } from "./finfluencers/FinfluencersPage";
import { PretendMoneyPage } from "./pretend-money/PretendMoneyPage";
import { RealTimeStocksPage } from "./stocks/RealTimeStocksPage";
import { AutopsyProvider } from "./workflow/AutopsyContext";

function renderWithProviders(initialPath: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AutopsyProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/stocks" element={<RealTimeStocksPage />} />
            <Route path="/pretend-money" element={<PretendMoneyPage />} />
            <Route path="/finfluencers" element={<FinfluencersPage />} />
            <Route path="/analyze" element={<div>Analyze Target Route</div>} />
          </Routes>
        </MemoryRouter>
      </AutopsyProvider>
    </QueryClientProvider>
  );
}

describe("Phase 4 — Real-Time Stocks & Finfluencers Pages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Real-Time Stocks with live provenance, neutral styling, and autopsy handoff", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/live/stocks/quotes")) {
        return new Response(
          JSON.stringify({
            request_id: "req_1",
            fetched_at: "2026-11-20T14:30:00.000Z",
            feed_status: "LIVE_FEED",
            benchmarks: [
              {
                key: "NIFTY_50",
                label: "NIFTY 50",
                status: "AVAILABLE",
                close: 25800.6,
                change: 150.2,
                change_percent: 0.59,
                as_of_date: "2026-11-20",
                fetched_at: "2026-11-20T14:30:00.000Z",
                data_freshness: "LIVE_FEED",
                data_label: "REAL",
                source_name: "Yahoo Finance NSE/BSE Live Feed",
                sparkline: [
                  { date: "2026-11-19", close: 25650 },
                  { date: "2026-11-20", close: 25800.6 },
                ],
              },
            ],
            quotes: [
              {
                ticker: "WIPRO",
                yahoo_symbol: "WIPRO.NS",
                company_name: "Wipro Limited",
                exchange: "NSE",
                sector: "IT Services",
                currency: "INR",
                price: 185.7,
                previous_close: 182.14,
                change: 3.56,
                change_percent: 1.95,
                day_high: 187.81,
                day_low: 181.0,
                fifty_two_week_high: 273.1,
                fifty_two_week_low: 156.79,
                volume: 14698164,
                market_cap_cr: 194500,
                size_band: "LARGE",
                as_of_date: "2026-11-20",
                fetched_at: "2026-11-20T14:30:00.000Z",
                data_freshness: "LIVE_FEED",
                data_label: "REAL",
                source_name: "Yahoo Finance NSE/BSE Live Feed",
                delay_note: "Near-real-time public NSE/BSE feed via Yahoo Finance.",
                sparkline: [
                  { date: "2026-11-19", close: 182.14 },
                  { date: "2026-11-20", close: 185.7 },
                ],
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/live/stocks/WIPRO/detail")) {
        return new Response(
          JSON.stringify({
            request_id: "req_2",
            range: "1mo",
            avg_daily_traded_value_cr: 272.95,
            quote: {
              ticker: "WIPRO",
              yahoo_symbol: "WIPRO.NS",
              company_name: "Wipro Limited",
              exchange: "NSE",
              sector: "IT Services",
              currency: "INR",
              price: 185.7,
              previous_close: 182.14,
              change: 3.56,
              change_percent: 1.95,
              day_high: 187.81,
              day_low: 181.0,
              fifty_two_week_high: 273.1,
              fifty_two_week_low: 156.79,
              volume: 14698164,
              market_cap_cr: 194500,
              size_band: "LARGE",
              as_of_date: "2026-11-20",
              fetched_at: "2026-11-20T14:30:00.000Z",
              data_freshness: "LIVE_FEED",
              data_label: "REAL",
              source_name: "Yahoo Finance NSE/BSE Live Feed",
              delay_note: "Near-real-time public NSE/BSE feed via Yahoo Finance.",
              sparkline: [],
            },
            series: [
              { label: "2026-11-19", trading_date: "2026-11-19", close: 182.14, volume: 12000000 },
              { label: "2026-11-20", trading_date: "2026-11-20", close: 185.7, volume: 14698164 },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    });

    renderWithProviders("/stocks");

    await waitFor(() => {
      expect(screen.getByText("Real-Time Stocks")).toBeInTheDocument();
      expect(screen.getAllByText("Real · Live Feed").length).toBeGreaterThan(0);
      expect(screen.getByText("NIFTY 50")).toBeInTheDocument();
      expect(screen.getAllByText("Wipro Limited").length).toBeGreaterThan(0);
    });

    // Click handoff CTA to /analyze
    const autopsyBtn = screen.getByRole("button", { name: /Run 5-Check Tip Autopsy on WIPRO/i });
    fireEvent.click(autopsyBtn);
    await waitFor(() => {
      expect(screen.getByText("Analyze Target Route")).toBeInTheDocument();
    });
  });

  it("renders Finfluencers directory, YouTube RSS video evidence, and opt-in WhatsApp subscription modal", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/finfluencers")) {
        return new Response(
          JSON.stringify({
            request_id: "req_f1",
            fetched_at: "2026-11-20T14:35:00.000Z",
            whatsapp_meta_configured: false,
            llm_provider: "disabled",
            items: [
              {
                id: "22222222-2222-4222-8222-222222222204",
                name: "Rakesh Bansal",
                handle: "@iamrakeshbansal",
                aliases: ["Dr Rakesh Bansal"],
                avatar_initials: "RB",
                bio_summary: "Publishes Hindi/Hinglish equity chart breakdowns on YouTube.",
                youtube_channel_id: "UC6HlGuJZ0_M_rSgm0hoRhDQ",
                youtube_handle: "@iamrakeshbansal",
                youtube_channel_url: "https://www.youtube.com/channel/UC6HlGuJZ0_M_rSgm0hoRhDQ",
                has_realtime_youtube_feed: true,
                sebi_status: "REGISTERED",
                sebi_registration_no: "INH100008984",
                sebi_category: "Research Analyst",
                sebi_snapshot_date: "2026-11-18",
                sebi_explanation: "Matched INH100008984.",
                active_subscriber_count: 1,
                latest_videos: [],
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/subscribe")) {
        return new Response(
          JSON.stringify({
            request_id: "req_sub1",
            message: "Subscribed in Preview (Dry-Run) mode.",
            subscription: {
              id: "sub-uuid-1",
              influencer_id: "22222222-2222-4222-8222-222222222204",
              influencer_name: "Rakesh Bansal",
              phone_masked: "+91******3210",
              provider: "dry_run",
              is_active: true,
              consent_given_at: "2026-11-20T14:36:00.000Z",
              unsubscribe_token: "unsub-token-1234567890",
            },
          }),
          { status: 201 }
        );
      }
      if (url.includes("/unsubscribe")) {
        return new Response(
          JSON.stringify({
            request_id: "req_unsub1",
            unsubscribed: true,
            phone_masked: "+91******3210",
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    });

    renderWithProviders("/finfluencers");

    await waitFor(() => {
      expect(screen.getByText("Rakesh Bansal")).toBeInTheDocument();
      expect(screen.getByText(/Registered · INH100008984/i)).toBeInTheDocument();
    });

    // Open Subscribe WhatsApp modal
    fireEvent.click(screen.getByRole("button", { name: /Subscribe WhatsApp Alerts/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Switch to Dry-Run preview mode, enter phone, check explicit opt-in consent, submit
    fireEvent.click(screen.getByLabelText(/Instant Preview \/ Dry-Run Mode/i));
    fireEvent.change(screen.getByLabelText(/WhatsApp Number/i), {
      target: { value: "+919876543210" },
    });
    const submitBtn = screen.getByRole("button", { name: /Confirm Opt-In Subscription/i });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Subscription Active \(\+91\*\*\*\*\*\*3210\)/i)).toBeInTheDocument();
    });

    // One-click unsubscribe works cleanly
    fireEvent.click(screen.getByRole("button", { name: /One-Click Unsubscribe/i }));
    await waitFor(() => {
      expect(screen.getByText(/Unsubscribed \+91\*\*\*\*\*\*3210/i)).toBeInTheDocument();
    });
  });

  it("renders Pretend Money 10-Year Stock Timeline page with wallet choices, scenarios, and Output-Guarded takeaways", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/timeline-10y")) {
        return new Response(
          JSON.stringify({
            request_id: "req_10y_1",
            ticker: "RELIANCE",
            yahoo_symbol: "RELIANCE.NS",
            company_name: "Reliance Industries Ltd",
            exchange: "NSE",
            sector: "Energy & Telecom",
            currency: "INR",
            start_date: "2016-11-20",
            end_date: "2026-11-20",
            fetched_at: "2026-11-20T15:00:00.000Z",
            as_of_date: "2026-11-20",
            data_freshness: "LIVE_FEED",
            data_label: "REAL",
            source_name: "Yahoo Finance 10Y Historical Weekly Feed (NSE/BSE + NIFTY 50)",
            snapshot_id: "live-yahoo-10y-weekly-v8",
            delay_note: "Historical 10-year weekly close series.",
            series: [
              { trading_date: "2016-11-20", close: 500, volume: 1200000, benchmark_close: 8100 },
              { trading_date: "2021-11-20", close: 1200, volume: 1500000, benchmark_close: 17800 },
              { trading_date: "2026-11-20", close: 1450, volume: 1800000, benchmark_close: 24200 },
            ],
            milestones: [
              {
                kind: "TEN_YEAR_START",
                label: "10Y Start",
                trading_date: "2016-11-20",
                close: 500,
                description: "Start of 10-year window",
              },
              {
                kind: "TEN_YEAR_HIGH",
                label: "10Y Historical High",
                trading_date: "2026-11-20",
                close: 1450,
                description: "High of 10-year window",
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/pretend-evaluate")) {
        return new Response(
          JSON.stringify({
            request_id: "req_eval_1",
            data_freshness: "LIVE_FEED",
            data_label: "REAL",
            source_name: "Yahoo Finance 10Y Historical Weekly Feed (NSE/BSE + NIFTY 50)",
            as_of_date: "2026-11-20",
            fetched_at: "2026-11-20T15:00:00.000Z",
            ticker: "RELIANCE",
            company_name: "Reliance Industries Ltd",
            starting_wallet_inr: 100000,
            evaluation_date: "2026-11-20",
            stop_loss_pct: null,
            total_allocated_inr: 50000,
            unallocated_cash_inr: 50000,
            stopped_out_cash_inr: 0,
            active_equity_value_inr: 145000,
            total_portfolio_value_inr: 195000,
            total_net_change_inr: 95000,
            total_return_pct: 95.0,
            portfolio_cagr_pct: 6.91,
            worst_tranche_drawdown_pct: 14.2,
            worst_drawdown_date: "2020-03-23",
            stopped_out_tranche_count: 0,
            nifty_equivalent_portfolio_inr: 199382,
            nifty_equivalent_return_pct: 99.38,
            fixed_reference_portfolio_inr: 143856,
            tranches: [
              {
                id: "tranche-init-RELIANCE-1",
                label: "10Y Start Choice",
                requested_entry_date: "2016-11-20",
                actual_entry_date: "2016-11-20",
                amount_inr: 50000,
                entry_price: 500,
                units_allocated: 100,
                status: "ACTIVE_AT_EVAL",
                stopped_out_date: null,
                stopped_out_price: null,
                eval_date: "2026-11-20",
                eval_price: 1450,
                final_value_inr: 145000,
                net_change_inr: 95000,
                return_pct: 190.0,
                holding_days: 3652,
                cagr_pct: 11.23,
                peak_value_inr: 145000,
                trough_value_inr: 42900,
                max_drawdown_pct: 14.2,
                max_drawdown_date: "2020-03-23",
                benchmark_entry_close: 8100,
                benchmark_eval_close: 24200,
                benchmark_final_value_inr: 149382,
                benchmark_return_pct: 198.76,
                fixed_reference_final_value_inr: 93856,
              },
            ],
            equity_curve: [
              {
                trading_date: "2016-11-20",
                stock_close: 500,
                deployed_capital_inr: 50000,
                portfolio_value_inr: 100000,
                nifty_equivalent_inr: 100000,
              },
              {
                trading_date: "2026-11-20",
                stock_close: 1450,
                deployed_capital_inr: 50000,
                portfolio_value_inr: 195000,
                nifty_equivalent_inr: 199382,
              },
            ],
            guard_status: "PASSED",
            observations: [
              {
                id: "historical_outcome_v1",
                title: "Historical Timeline Outcome",
                sentence:
                  "Across 1 historical allocation(s) totaling ₹50,000 evaluated through 2026-11-20, the pretend wallet changed by +95.00% to ₹1,95,000.",
                guard_passed: true,
              },
            ],
            mandatory_disclaimer:
              "This report describes historical facts and risk factors around a tip. It is not investment advice or SEBI-registered research. The decision is yours.",
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    });

    renderWithProviders("/pretend-money");

    await waitFor(() => {
      expect(screen.getByText(/Pretend Money · 10-Year Stock Timeline/i)).toBeInTheDocument();
      expect(screen.getByText(/Graph Pointers:/i)).toBeInTheDocument();
      expect(screen.getByText(/1\. Invest on:/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Hold till:/i)).toBeInTheDocument();
      expect(screen.getByText(/Hold & Return Calculation · Pointer 1 to Pointer 2/i)).toBeInTheDocument();
      expect(screen.getByText(/1\. Money Invested/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Time Held/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Profit & Loss/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. Total Stock Return %/i)).toBeInTheDocument();
      expect(screen.getByText(/Guarded Historical Evidence Takeaways/i)).toBeInTheDocument();
      expect(screen.getByText(/Output Guard Verified/i)).toBeInTheDocument();
      expect(screen.getAllByText(/₹1,95,000/i).length).toBeGreaterThan(0);
    });

    // Verify Slider 2 enforces constraint min >= Pointer 1 index
    const pointer2Slider = screen.getByLabelText(/Pointer 2 \(Hold Till Date\):/i) as HTMLInputElement;
    const pointer1Slider = screen.getByLabelText(/Pointer 1 \(Invest Date\):/i) as HTMLInputElement;
    expect(Number(pointer2Slider.min)).toBeGreaterThanOrEqual(Number(pointer1Slider.value));

    // Apply a one-click scenario preset
    fireEvent.click(screen.getByRole("button", { name: /100% Lump Sum 10 Years Ago/i }));
    await waitFor(() => {
      expect(screen.getByText(/NIFTY 50 Baseline/i)).toBeInTheDocument();
    });
  });
});
