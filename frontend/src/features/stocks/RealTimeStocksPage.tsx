import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowsClockwise,
  Broadcast,
  ChartLineUp,
  Info,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { ProvenancePill } from "../../components/ui/ProvenancePill";
import { StatusBadge } from "../../components/ui/StatusBadge";
import {
  fetchLiveQuotes,
  fetchLiveStockDetail,
  searchLiveStocks,
} from "../../lib/apiClient";
import type { LiveStockQuote, LiveStockSearchItem } from "../../types/api";

const RANGE_OPTIONS: Array<{ value: "1d" | "1mo" | "3mo" | "6mo"; label: string }> = [
  { value: "1d", label: "1D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
];

function buildSparklinePoints(values: number[]): string {
  if (values.length < 2) return "4,20 116,20";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = 4 + (i / (values.length - 1)) * 112;
      const y = 30 - ((v - min) / span) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatInr(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return "—";
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVolume(vol: number | null): string {
  if (vol === null || !Number.isFinite(vol)) return "Could not verify";
  if (vol >= 1e7) return `${(vol / 1e7).toFixed(2)} Cr`;
  if (vol >= 1e5) return `${(vol / 1e5).toFixed(2)} L`;
  return vol.toLocaleString("en-IN");
}

function formatSizeBand(band: LiveStockQuote["size_band"]): string {
  if (!band) return "Could not verify";
  return `${band.charAt(0)}${band.slice(1).toLowerCase()} Cap`;
}

export function RealTimeStocksPage() {
  const navigate = useNavigate();
  const [customTickers, setCustomTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>("WIPRO");
  const [range, setRange] = useState<"1d" | "1mo" | "3mo" | "6mo">("1mo");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const quotesQuery = useQuery({
    queryKey: ["live-stocks-quotes", customTickers.join(",")],
    queryFn: () => fetchLiveQuotes(customTickers.length > 0 ? customTickers : undefined),
    refetchInterval: 45_000,
  });

  const searchQuery = useQuery({
    queryKey: ["live-stocks-search", debouncedSearch],
    queryFn: () => searchLiveStocks(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const detailQuery = useQuery({
    queryKey: ["live-stock-detail", selectedTicker, range],
    queryFn: () => fetchLiveStockDetail(selectedTicker, range),
    enabled: selectedTicker.length > 0,
    refetchInterval: range === "1d" ? 45_000 : false,
  });

  const quotes = useMemo(() => quotesQuery.data?.quotes ?? [], [quotesQuery.data?.quotes]);
  const benchmarks = quotesQuery.data?.benchmarks ?? [];
  const feedStatus = quotesQuery.data?.feed_status ?? "SNAPSHOT_FALLBACK";

  const activeQuote = useMemo(() => {
    if (detailQuery.data?.quote) return detailQuery.data.quote;
    return quotes.find((q) => q.ticker === selectedTicker) ?? quotes[0] ?? null;
  }, [detailQuery.data?.quote, quotes, selectedTicker]);

  function handleSelectSearchItem(item: LiveStockSearchItem) {
    setSelectedTicker(item.ticker);
    setCustomTickers((prev) => {
      const base = prev.length > 0 ? prev : quotes.map((q) => q.ticker);
      if (base.includes(item.ticker)) return prev;
      return [item.ticker, ...base].slice(0, 14);
    });
    setSearchText("");
    setDebouncedSearch("");
  }

  function handleInspectInAutopsy(quote: LiveStockQuote) {
    navigate("/analyze", {
      state: {
        prefillStockName: quote.ticker,
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Header + Live Freshness Provenance */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ChartLineUp size={22} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-[#161A18]">
              Real-Time Stocks
            </h1>
            <ProvenancePill
              label={feedStatus === "LIVE_FEED" ? "Real · Live Feed" : "Real · Dated Snapshot"}
              fetchedAtIso={feedStatus === "LIVE_FEED" ? quotesQuery.data?.fetched_at : null}
              asOfDate={activeQuote?.as_of_date}
            />
          </div>
          <p className="mt-1 mb-0 text-[13.5px] text-[#4A524D]">
            Zero-cost near-real-time NSE &amp; BSE market context with automatic dated-snapshot
            fallback. Prices and volumes are shown neutrally—never as buy or sell signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              void quotesQuery.refetch();
              void detailQuery.refetch();
            }}
            disabled={quotesQuery.isFetching}
            className="h-10 px-4 text-[13px]"
          >
            <ArrowsClockwise
              size={16}
              weight="regular"
              className={quotesQuery.isFetching ? "animate-spin" : ""}
              aria-hidden="true"
            />
            <span>{quotesQuery.isFetching ? "Refreshing..." : "Refresh Feed"}</span>
          </Button>
        </div>
      </div>

      {/* Live Benchmark Strip */}
      <section aria-label="Live Indian market indices" className="grid gap-3 md:grid-cols-3">
        {benchmarks.map((idx) => {
          const available = idx.status === "AVAILABLE" && idx.close !== null;
          const isPositive = (idx.change ?? 0) >= 0;
          return (
            <GlassCard key={idx.key} compact className="flex flex-col justify-between gap-2 !p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="m-0 text-[11.5px] font-semibold tracking-[0.04em] text-[#6E7771] uppercase">
                    {idx.label}
                  </p>
                  <p className="tabular-nums-lining mt-0.5 mb-0 text-[20px] font-bold tracking-[-0.02em] text-[#161A18]">
                    {available
                      ? idx.close!.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                      : "—"}
                  </p>
                </div>
                {available && idx.change_percent !== null ? (
                  <span
                    className={`tabular-nums-lining rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
                      isPositive
                        ? "bg-[#E6F2EC] text-[#1F4D3A]"
                        : "bg-[#EFECE6] text-[#4A524D]"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {idx.change_percent}%
                  </span>
                ) : (
                  <StatusBadge tone="unverified" label="Could not verify" />
                )}
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="tabular-nums-lining truncate text-[11.5px] text-[#6E7771]">
                  {idx.data_freshness === "LIVE_FEED"
                    ? `Live Feed · ${idx.as_of_date ?? ""}`
                    : idx.as_of_date
                      ? `Snapshot · As of ${idx.as_of_date}`
                      : "Feed unavailable"}
                </span>
                <svg viewBox="0 0 120 34" className="h-7 w-20 shrink-0" aria-hidden="true">
                  <polyline
                    fill="none"
                    stroke="#3B8E6A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={buildSparklinePoints(idx.sparkline.map((s) => s.close))}
                  />
                </svg>
              </div>
            </GlassCard>
          );
        })}
      </section>

      {/* Universal NSE/BSE Real-Time Search Bar */}
      <div className="relative">
        <div className="glass-card flex items-center gap-2.5 rounded-2xl px-4 py-2">
          <MagnifyingGlass
            size={18}
            weight="regular"
            className="shrink-0 text-[#6E7771]"
            aria-hidden="true"
          />
          <label htmlFor="live-stock-search" className="sr-only">
            Search any NSE or BSE stock ticker or company name
          </label>
          <input
            id="live-stock-search"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search any NSE / BSE stock in real time (e.g., RELIANCE, ZOMATO, ITC, TRENT, WIPRO)..."
            className="h-9 w-full bg-transparent text-[14px] text-[#161A18] placeholder:text-[#6E7771] focus:outline-none"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setDebouncedSearch("");
              }}
              className="text-[12px] font-medium text-[#6E7771] hover:text-[#161A18]"
            >
              Clear
            </button>
          )}
        </div>

        {debouncedSearch.length >= 2 && (
          <div
            role="listbox"
            aria-label="Live NSE and BSE stock search matches"
            className="absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-[rgba(22,26,24,0.1)] bg-white/96 shadow-[0_18px_40px_-10px_rgba(22,26,24,0.14)] backdrop-blur-xl"
          >
            {searchQuery.isLoading ? (
              <div className="p-3.5 text-[13px] text-[#6E7771]">
                Searching live NSE / BSE equities...
              </div>
            ) : (searchQuery.data ?? []).length === 0 ? (
              <div className="p-3.5 text-[13px] text-[#6E7771]">
                No matching NSE or BSE equity found for “{debouncedSearch}”.
              </div>
            ) : (
              <ul className="m-0 max-h-64 list-none divide-y divide-[rgba(22,26,24,0.06)] overflow-y-auto p-0">
                {(searchQuery.data ?? []).map((item) => (
                  <li key={`${item.ticker}-${item.exchange}`}>
                    <button
                      type="button"
                      onClick={() => handleSelectSearchItem(item)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#E6F2EC]/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#161A18]">{item.ticker}</span>
                          <span className="rounded-md bg-[#EFECE6] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#4A524D]">
                            {item.exchange}
                          </span>
                          {item.sector && (
                            <span className="truncate text-[11.5px] text-[#6E7771]">
                              {item.sector}
                            </span>
                          )}
                        </div>
                        <p className="m-0 truncate text-[12.5px] text-[#4A524D]">
                          {item.company_name}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E6F2EC] px-2.5 py-1 text-[11.5px] font-semibold text-[#1F4D3A]">
                        <Plus size={12} weight="bold" aria-hidden="true" />
                        Inspect
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Main 12-Col Split Workspace: Watchlist Table (7 cols) + Live Detail Chart Panel (5 cols) */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Watchlist Table */}
        <GlassCard className="overflow-hidden p-0 sm:p-0 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(22,26,24,0.08)] bg-white/55 px-4 py-3">
            <div>
              <h2 className="m-0 text-[15.5px] font-semibold text-[#161A18]">
                NSE / BSE Live Market Watch
              </h2>
              <p className="m-0 text-[12px] text-[#6E7771]">
                Select any security to inspect intraday/historical context or run a Tip Autopsy.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFECE6] px-2.5 py-1 text-[11px] font-semibold text-[#4A524D]">
              <Broadcast size={12} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
              Auto-refreshes every 45s
            </span>
          </div>

          {quotesQuery.isLoading ? (
            <div className="space-y-2.5 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton-shimmer h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : quotes.length === 0 ? (
            <div className="p-6 text-center">
              <StatusBadge tone="unverified" label="Could not verify live quotes" />
              <p className="mt-2 mb-0 text-[13px] text-[#4A524D]">
                The free live market feed is temporarily unavailable and no snapshot rows matched.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[rgba(22,26,24,0.08)] bg-white/45 text-[11px] font-semibold tracking-[0.04em] text-[#4A524D] uppercase">
                    <th className="px-4 py-2.5">Security</th>
                    <th className="px-3 py-2.5 text-right">Last Price</th>
                    <th className="px-3 py-2.5 text-right">Session Move</th>
                    <th className="px-3 py-2.5 text-right">Volume</th>
                    <th className="px-4 py-2.5 text-right">Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(22,26,24,0.07)] text-[13.5px]">
                  {quotes.map((q) => {
                    const isSelected = q.ticker === selectedTicker;
                    const isPositive = (q.change ?? 0) >= 0;
                    return (
                      <tr
                        key={q.ticker}
                        onClick={() => setSelectedTicker(q.ticker)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-[#E6F2EC]/55" : "hover:bg-white/65"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#161A18]">{q.ticker}</span>
                            <span className="rounded bg-[#EFECE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#4A524D]">
                              {q.exchange}
                            </span>
                          </div>
                          <p className="m-0 max-w-[200px] truncate text-[12px] text-[#6E7771]">
                            {q.company_name}
                          </p>
                        </td>
                        <td className="tabular-nums-lining px-3 py-2.5 text-right font-semibold text-[#161A18]">
                          {formatInr(q.price)}
                        </td>
                        <td className="tabular-nums-lining px-3 py-2.5 text-right">
                          {q.change_percent !== null ? (
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                                isPositive
                                  ? "bg-[#E6F2EC] text-[#1F4D3A]"
                                  : "bg-[#EFECE6] text-[#4A524D]"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {q.change_percent}%
                            </span>
                          ) : (
                            <span className="text-[12px] text-[#6E7771]">—</span>
                          )}
                        </td>
                        <td className="tabular-nums-lining px-3 py-2.5 text-right text-[12.5px] text-[#4A524D]">
                          {formatVolume(q.volume)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              q.data_freshness === "LIVE_FEED"
                                ? "bg-[#E6F2EC] text-[#1F4D3A]"
                                : "bg-[#EFECE6] text-[#4A524D]"
                            }`}
                          >
                            {q.data_freshness === "LIVE_FEED" ? "Live Feed" : "Snapshot"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Live Selected Stock Detail & Chart Panel */}
        <GlassCard className="flex flex-col justify-between gap-4 xl:col-span-5">
          {activeQuote ? (
            <>
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="m-0 text-[18px] font-bold tracking-[-0.015em] text-[#161A18]">
                        {activeQuote.ticker}
                      </h2>
                      <span className="rounded-md bg-[#EFECE6] px-2 py-0.5 text-[11px] font-semibold text-[#4A524D]">
                        {activeQuote.exchange}
                      </span>
                      {activeQuote.size_band && (
                        <span className="rounded-full bg-[#E6F2EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#1F4D3A]">
                          {formatSizeBand(activeQuote.size_band)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 mb-0 text-[13px] text-[#4A524D]">
                      {activeQuote.company_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums-lining m-0 text-[22px] font-bold tracking-[-0.02em] text-[#161A18]">
                      {formatInr(activeQuote.price)}
                    </p>
                    <p className="tabular-nums-lining m-0 text-[12px] font-semibold text-[#4A524D]">
                      {activeQuote.change !== null && activeQuote.change_percent !== null
                        ? `${activeQuote.change >= 0 ? "+" : ""}${activeQuote.change} (${
                            activeQuote.change >= 0 ? "+" : ""
                          }${activeQuote.change_percent}%)`
                        : "Session delta unavailable"}
                    </p>
                  </div>
                </div>

                {/* Range Segmented Control */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    role="tablist"
                    aria-label="Chart timeframe"
                    className="inline-flex rounded-xl bg-[#F3F0EA] p-1"
                  >
                    {RANGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={range === opt.value}
                        onClick={() => setRange(opt.value)}
                        className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-all ${
                          range === opt.value
                            ? "bg-white text-[#161A18] shadow-[0_2px_8px_rgba(22,26,24,0.08)]"
                            : "text-[#4A524D] hover:text-[#161A18]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <ProvenancePill
                    label={
                      activeQuote.data_freshness === "LIVE_FEED"
                        ? "Real · Live Feed"
                        : "Real · Dated Snapshot"
                    }
                    asOfDate={activeQuote.as_of_date}
                  />
                </div>

                {/* Interactive Price & Volume Chart */}
                <div className="h-[220px] w-full rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/85 p-3">
                  {detailQuery.isLoading ? (
                    <div className="skeleton-shimmer h-full w-full rounded-xl" />
                  ) : (detailQuery.data?.series ?? []).length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-[#6E7771]">
                      Could not verify chart series for this range.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={detailQuery.data?.series ?? []}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="liveStockArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B8E6A" stopOpacity={0.24} />
                            <stop offset="95%" stopColor="#3B8E6A" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="rgba(22,26,24,0.06)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#6E7771" }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                        />
                        <YAxis
                          yAxisId="price"
                          domain={["auto", "auto"]}
                          tick={{ fontSize: 11, fill: "#6E7771" }}
                          tickLine={false}
                          axisLine={false}
                          width={54}
                        />
                        <YAxis yAxisId="vol" orientation="right" hide />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid rgba(22,26,24,0.1)",
                            backgroundColor: "rgba(255,255,255,0.96)",
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          yAxisId="vol"
                          dataKey="volume"
                          fill="#A7B8B0"
                          opacity={0.25}
                          radius={[2, 2, 0, 0]}
                        />
                        <Area
                          yAxisId="price"
                          type="monotone"
                          dataKey="close"
                          stroke="#3B8E6A"
                          strokeWidth={2}
                          fill="url(#liveStockArea)"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Objective Context Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4]/90 p-3">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.03em] text-[#6E7771] uppercase">
                      Day Range
                    </p>
                    <p className="tabular-nums-lining mt-1 mb-0 text-[13px] font-semibold text-[#161A18]">
                      {activeQuote.day_low !== null && activeQuote.day_high !== null
                        ? `${formatInr(activeQuote.day_low)} – ${formatInr(activeQuote.day_high)}`
                        : "Could not verify"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4]/90 p-3">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.03em] text-[#6E7771] uppercase">
                      52-Week Range
                    </p>
                    <p className="tabular-nums-lining mt-1 mb-0 text-[13px] font-semibold text-[#161A18]">
                      {activeQuote.fifty_two_week_low !== null &&
                      activeQuote.fifty_two_week_high !== null
                        ? `${formatInr(activeQuote.fifty_two_week_low)} – ${formatInr(
                            activeQuote.fifty_two_week_high
                          )}`
                        : "Could not verify"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4]/90 p-3">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.03em] text-[#6E7771] uppercase">
                      Est. Daily Traded Value
                    </p>
                    <p className="tabular-nums-lining mt-1 mb-0 text-[13px] font-semibold text-[#161A18]">
                      {detailQuery.data?.avg_daily_traded_value_cr !== null &&
                      detailQuery.data?.avg_daily_traded_value_cr !== undefined
                        ? `₹${detailQuery.data.avg_daily_traded_value_cr.toLocaleString("en-IN")} Cr`
                        : "Could not verify"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4]/90 p-3">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.03em] text-[#6E7771] uppercase">
                      Market Cap Band
                    </p>
                    <p className="tabular-nums-lining mt-1 mb-0 text-[13px] font-semibold text-[#161A18]">
                      {activeQuote.market_cap_cr !== null
                        ? `₹${activeQuote.market_cap_cr.toLocaleString("en-IN")} Cr (${formatSizeBand(
                            activeQuote.size_band
                          )})`
                        : "Could not verify"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-[rgba(22,26,24,0.08)] bg-white/65 px-3 py-2 text-[12px] text-[#4A524D]">
                  <Info
                    size={15}
                    weight="duotone"
                    className="mt-0.5 shrink-0 text-[#4A7C64]"
                    aria-hidden="true"
                  />
                  <span>{activeQuote.delay_note}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => handleInspectInAutopsy(activeQuote)}
                className="w-full"
              >
                <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
                <span>Run 5-Check Tip Autopsy on {activeQuote.ticker}</span>
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <ChartLineUp size={32} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />
              <p className="mt-2 mb-0 text-[14px] font-medium text-[#161A18]">
                Select any NSE or BSE equity to inspect real-time market context.
              </p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
