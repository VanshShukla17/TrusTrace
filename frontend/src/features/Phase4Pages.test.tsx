import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinfluencersPage } from "./finfluencers/FinfluencersPage";
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
});
