import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowRight,
  CalendarBlank,
  ChartLineUp,
  ClockCounterClockwise,
  Coins,
  FastForward,
  Info,
  MagnifyingGlass,
  MapPin,
  Plus,
  ShieldCheck,
  Sliders,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
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
  evaluatePretendMoney,
  fetchTenYearTimeline,
  searchLiveStocks,
} from "../../lib/apiClient";
import type {
  LiveStockSearchItem,
  PretendTrancheInput,
  TenYearTimelineMilestone,
} from "../../types/api";

const POPULAR_10Y_STOCKS: Array<{ ticker: string; name: string }> = [
  { ticker: "RELIANCE", name: "Reliance Industries" },
  { ticker: "TCS", name: "Tata Consultancy Services" },
  { ticker: "HDFCBANK", name: "HDFC Bank" },
  { ticker: "WIPRO", name: "Wipro Limited" },
  { ticker: "INFY", name: "Infosys" },
  { ticker: "SBIN", name: "State Bank of India" },
  { ticker: "TATAMOTORS", name: "Tata Motors" },
  { ticker: "ICICIBANK", name: "ICICI Bank" },
  { ticker: "BORORENEW", name: "Borosil Renewables" },
  { ticker: "SARVESHWAR", name: "Sarveshwar Foods" },
];

const WALLET_PRESETS_INR = [25_000, 100_000, 500_000, 1_000_000] as const;

const STOP_LOSS_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: "No Stop-Loss (Unprotected)" },
  { value: 10, label: "10% Stop-Loss Rule" },
  { value: 15, label: "15% Stop-Loss Rule" },
  { value: 20, label: "20% Stop-Loss Rule" },
  { value: 30, label: "30% Stop-Loss Rule" },
];

type TimelineZoomWindow = "1Y" | "3Y" | "5Y" | "10Y";

function formatInr(val: number | null | undefined, decimals = 0): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return `₹${val.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatSignedPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

export function PretendMoneyPage() {
  const navigate = useNavigate();

  // Stock selection & search state
  const [selectedTicker, setSelectedTicker] = useState<string>("RELIANCE");
  const [searchText, setSearchText] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Transient Pretend Wallet & Real Choices State (In-Session Client Memory Only)
  const [startingWalletInr, setStartingWalletInr] = useState<number>(100_000);
  const [tranches, setTranches] = useState<PretendTrancheInput[]>([]);
  const [stopLossPct, setStopLossPct] = useState<number | null>(null);

  // Selected timeline date for applying new pretend money & evaluation scrubber date
  const [selectedEntryDate, setSelectedEntryDate] = useState<string>("");
  const [allocationAmountInr, setAllocationAmountInr] = useState<number>(25_000);
  const [allocationLabel, setAllocationLabel] = useState<string>("");
  const [evalBarIndex, setEvalBarIndex] = useState<number | null>(null);
  const [zoomWindow, setZoomWindow] = useState<TimelineZoomWindow>("10Y");
  const [chartClickMode, setChartClickMode] = useState<"SELECT_DATE" | "INSTANT_ALLOCATE">(
    "SELECT_DATE"
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const searchQuery = useQuery({
    queryKey: ["live-stocks-search-10y", debouncedSearch],
    queryFn: () => searchLiveStocks(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const timelineQuery = useQuery({
    queryKey: ["ten-year-timeline", selectedTicker],
    queryFn: () => fetchTenYearTimeline(selectedTicker),
    enabled: selectedTicker.length > 0,
  });

  const fullSeries = useMemo(
    () => timelineQuery.data?.series ?? [],
    [timelineQuery.data?.series]
  );

  // Initialize default entry date, initial scenario, and evaluation cursor whenever the 10Y series loads
  useEffect(() => {
    if (fullSeries.length === 0) return;
    const lastIdx = fullSeries.length - 1;
    setEvalBarIndex(lastIdx);

    // Default to placing an initial 50% pretend allocation at the start of the 10-year timeline so the user sees an immediate interactive example
    const startBar = fullSeries[0]!;
    const midIdx = Math.floor(fullSeries.length * 0.45);
    const midBar = fullSeries[midIdx] ?? startBar;
    setSelectedEntryDate(midBar.trading_date);
    setTranches([
      {
        id: `tranche-init-${selectedTicker}-1`,
        entry_date: startBar.trading_date,
        amount_inr: Math.round(startingWalletInr * 0.5),
        label: "10Y Start Choice",
      },
    ]);
    setAllocationAmountInr(Math.round(startingWalletInr * 0.25));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullSeries, selectedTicker]);

  const effectiveEvalIndex = useMemo(() => {
    if (fullSeries.length === 0) return 0;
    if (evalBarIndex === null || evalBarIndex >= fullSeries.length) {
      return fullSeries.length - 1;
    }
    return Math.max(0, evalBarIndex);
  }, [evalBarIndex, fullSeries.length]);

  const evaluationDate = useMemo(() => {
    if (fullSeries.length === 0) return undefined;
    return fullSeries[effectiveEvalIndex]?.trading_date;
  }, [effectiveEvalIndex, fullSeries]);

  const selectedEntryBar = useMemo(() => {
    if (fullSeries.length === 0) return null;
    if (!selectedEntryDate) return fullSeries[0] ?? null;
    for (let i = 0; i < fullSeries.length; i += 1) {
      if (fullSeries[i]!.trading_date >= selectedEntryDate) {
        return fullSeries[i]!;
      }
    }
    return fullSeries[fullSeries.length - 1] ?? null;
  }, [fullSeries, selectedEntryDate]);

  // Evaluate pretend money choices deterministically via the backend Output-Guarded endpoint
  const evalQuery = useQuery({
    queryKey: [
      "pretend-money-eval",
      selectedTicker,
      startingWalletInr,
      evaluationDate,
      stopLossPct,
      JSON.stringify(tranches),
    ],
    queryFn: () =>
      evaluatePretendMoney({
        ticker: selectedTicker,
        starting_wallet_inr: startingWalletInr,
        evaluation_date: evaluationDate,
        stop_loss_pct: stopLossPct,
        tranches,
      }),
    enabled: Boolean(selectedTicker && fullSeries.length > 0),
  });

  const totalAllocatedSoFar = useMemo(() => {
    const sum = tranches.reduce((acc, t) => acc + t.amount_inr, 0);
    return Math.min(startingWalletInr, sum);
  }, [startingWalletInr, tranches]);

  const remainingWalletCash = Math.max(0, startingWalletInr - totalAllocatedSoFar);

  const visibleSeries = useMemo(() => {
    if (fullSeries.length === 0) return [];
    const weeksMap: Record<TimelineZoomWindow, number> = {
      "1Y": 52,
      "3Y": 156,
      "5Y": 260,
      "10Y": fullSeries.length,
    };
    const count = weeksMap[zoomWindow];
    return fullSeries.slice(-count);
  }, [fullSeries, zoomWindow]);

  function handleSelectStock(ticker: string) {
    setSelectedTicker(ticker);
    setSearchText("");
    setDebouncedSearch("");
  }

  function handleSelectSearchItem(item: LiveStockSearchItem) {
    handleSelectStock(item.ticker);
  }

  function handleChangeWalletSize(newWalletInr: number) {
    const clamped = Math.max(1_000, Math.min(100_000_000, Math.round(newWalletInr)));
    const ratio = startingWalletInr > 0 ? clamped / startingWalletInr : 1;
    setStartingWalletInr(clamped);
    setTranches((prev) =>
      prev.map((t) => ({
        ...t,
        amount_inr: Math.max(500, Math.round(t.amount_inr * ratio)),
      }))
    );
    setAllocationAmountInr(Math.round(clamped * 0.25));
  }

  function handleAddAllocationOnDate(targetDate?: string, customAmount?: number, customLabel?: string) {
    const dateToUse = targetDate || selectedEntryBar?.trading_date;
    if (!dateToUse) return;

    const amt = Math.min(
      remainingWalletCash,
      Math.max(500, Math.round(customAmount ?? allocationAmountInr))
    );
    if (amt <= 0) return;

    const newTranche: PretendTrancheInput = {
      id: `tranche-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      entry_date: dateToUse,
      amount_inr: amt,
      label:
        customLabel ||
        allocationLabel.trim() ||
        `Choice on ${dateToUse}`,
    };

    setTranches((prev) => [...prev, newTranche]);
    setAllocationLabel("");

    // If evaluation date is earlier than the new allocation date, move evaluation cursor to the end of 10Y
    const placedIdx = fullSeries.findIndex((b) => b.trading_date >= dateToUse);
    if (placedIdx >= 0 && placedIdx > effectiveEvalIndex) {
      setEvalBarIndex(fullSeries.length - 1);
    }
  }

  function handleRemoveTranche(id: string) {
    setTranches((prev) => prev.filter((t) => t.id !== id));
  }

  function handleResetWallet() {
    setTranches([]);
    if (fullSeries.length > 0) {
      setEvalBarIndex(fullSeries.length - 1);
    }
  }

  // Real-World Historical Choice Presets across the 10-Year Timeline
  function applyScenarioPreset(
    preset: "LUMP_SUM_10Y_START" | "CHASED_RUNUP_PEAK" | "YEARLY_STAGGERED_10Y" | "DIP_AND_RECOVERY"
  ) {
    if (fullSeries.length === 0) return;
    setEvalBarIndex(fullSeries.length - 1);
    setZoomWindow("10Y");

    if (preset === "LUMP_SUM_10Y_START") {
      const startBar = fullSeries[0]!;
      setSelectedEntryDate(startBar.trading_date);
      setTranches([
        {
          id: `preset-lumpsum-${Date.now()}`,
          entry_date: startBar.trading_date,
          amount_inr: startingWalletInr,
          label: "100% Lump Sum at 10Y Start",
        },
      ]);
      return;
    }

    if (preset === "CHASED_RUNUP_PEAK") {
      const milestones = timelineQuery.data?.milestones ?? [];
      const runupMilestone =
        milestones.find((m) => m.kind === "SHARPEST_RUNUP_PEAK") ??
        milestones.find((m) => m.kind === "TEN_YEAR_HIGH");
      const targetDate =
        runupMilestone?.trading_date ??
        fullSeries[Math.floor(fullSeries.length * 0.65)]!.trading_date;
      setSelectedEntryDate(targetDate);
      setTranches([
        {
          id: `preset-runup-${Date.now()}`,
          entry_date: targetDate,
          amount_inr: startingWalletInr,
          label: "Chased Pre-Tip Run-Up Peak",
        },
      ]);
      return;
    }

    if (preset === "YEARLY_STAGGERED_10Y") {
      const numTranches = Math.min(10, fullSeries.length);
      const step = Math.max(1, Math.floor(fullSeries.length / numTranches));
      const perTranche = Math.floor(startingWalletInr / numTranches);
      const built: PretendTrancheInput[] = [];
      for (let i = 0; i < numTranches; i += 1) {
        const bar = fullSeries[Math.min(fullSeries.length - 1, i * step)]!;
        built.push({
          id: `preset-yearly-${i + 1}-${Date.now()}`,
          entry_date: bar.trading_date,
          amount_inr: i === numTranches - 1 ? startingWalletInr - perTranche * (numTranches - 1) : perTranche,
          label: `Year ${i + 1} Staggered Tranche`,
        });
      }
      setTranches(built);
      return;
    }

    if (preset === "DIP_AND_RECOVERY") {
      const milestones = timelineQuery.data?.milestones ?? [];
      const startDate = fullSeries[0]!.trading_date;
      const troughMilestone = milestones.find((m) => m.kind === "DEEPEST_DRAWDOWN_TROUGH");
      const troughDate =
        troughMilestone?.trading_date ??
        fullSeries[Math.floor(fullSeries.length * 0.35)]!.trading_date;
      const lateDate = fullSeries[Math.floor(fullSeries.length * 0.72)]!.trading_date;

      const t1 = Math.round(startingWalletInr * 0.3);
      const t2 = Math.round(startingWalletInr * 0.4);
      const t3 = startingWalletInr - t1 - t2;

      setTranches([
        {
          id: `preset-split-1-${Date.now()}`,
          entry_date: startDate,
          amount_inr: t1,
          label: "Initial Base Tranche (30%)",
        },
        {
          id: `preset-split-2-${Date.now()}`,
          entry_date: troughDate,
          amount_inr: t2,
          label: "Pullback Trough Tranche (40%)",
        },
        {
          id: `preset-split-3-${Date.now()}`,
          entry_date: lateDate,
          amount_inr: t3,
          label: "Mid-Cycle Follow-On (30%)",
        },
      ]);
    }
  }

  function handleStepEvaluationTimeline(weeksDelta: number) {
    if (fullSeries.length === 0) return;
    setEvalBarIndex((prev) => {
      const current = prev ?? fullSeries.length - 1;
      return Math.max(0, Math.min(fullSeries.length - 1, current + weeksDelta));
    });
  }

  function handleMilestoneClick(milestone: TenYearTimelineMilestone) {
    setSelectedEntryDate(milestone.trading_date);
    setZoomWindow("10Y");
  }

  const evalData = evalQuery.data;
  const timelineMeta = timelineQuery.data;

  // Map tranche dates for ReferenceDot rendering on the 10Y chart
  const tranchePinsByDate = useMemo(() => {
    const map = new Map<
      string,
      { close: number; totalAmount: number; count: number; stoppedOut: boolean }
    >();
    const closeByDate = new Map(fullSeries.map((b) => [b.trading_date, b.close]));
    for (const et of evalData?.tranches ?? []) {
      const close = closeByDate.get(et.actual_entry_date) ?? et.entry_price;
      const existing = map.get(et.actual_entry_date);
      map.set(et.actual_entry_date, {
        close,
        totalAmount: (existing?.totalAmount ?? 0) + et.amount_inr,
        count: (existing?.count ?? 0) + 1,
        stoppedOut: Boolean(existing?.stoppedOut || et.status === "STOP_LOSS_TRIGGERED"),
      });
    }
    return map;
  }, [evalData?.tranches, fullSeries]);

  return (
    <div className="space-y-4">
      {/* Header + Data Provenance */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Coins size={22} weight="duotone" className="text-[#9A5B13]" aria-hidden="true" />
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-[#161A18]">
              Pretend Money · 10-Year Stock Timeline
            </h1>
            {timelineMeta && (
              <ProvenancePill
                label={
                  timelineMeta.data_freshness === "LIVE_FEED"
                    ? "Real · Live Feed"
                    : "Synthetic / Demo"
                }
                fetchedAtIso={
                  timelineMeta.data_freshness === "LIVE_FEED" ? timelineMeta.fetched_at : null
                }
                asOfDate={timelineMeta.as_of_date}
              />
            )}
          </div>
          <p className="mt-1 mb-0 text-[13.5px] text-[#4A524D]">
            Practice real allocation, entry-timing, and stop-loss choices using virtual pretend
            money across a 10-year historical timeline ({timelineMeta?.start_date ?? "2016"} to{" "}
            {timelineMeta?.end_date ?? "2026"}). Compare every choice against passive{" "}
            <strong>NIFTY 50</strong> index movement—never as investment advice.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleResetWallet}
            disabled={tranches.length === 0}
            className="h-10 px-3.5 text-[12.5px]"
          >
            <ArrowCounterClockwise size={15} weight="bold" aria-hidden="true" />
            <span>Reset Pretend Wallet</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              navigate("/analyze", {
                state: { prefillStockName: selectedTicker },
              })
            }
            className="h-10 px-4 text-[12.5px]"
          >
            <span>Inspect {selectedTicker} in Tip Autopsy</span>
            <ArrowRight size={15} weight="bold" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Top Setup Strip: Stock Selector + Pretend Wallet Configuration */}
      <div className="grid gap-3 xl:grid-cols-12">
        {/* Left 7 cols: Universal NSE/BSE Stock Search + Quick Popular 10Y Equities */}
        <GlassCard compact className="space-y-2.5 !p-4 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-semibold tracking-[0.04em] text-[#4A524D] uppercase">
              1. Choose NSE / BSE Stock for 10-Year Timeline
            </span>
            {timelineMeta && (
              <span className="tabular-nums-lining text-[12px] font-medium text-[#6E7771]">
                {timelineMeta.company_name} ({timelineMeta.exchange}) · {fullSeries.length} weekly
                bars
              </span>
            )}
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(22,26,24,0.12)] bg-white/90 px-3 py-1.5">
              <MagnifyingGlass
                size={17}
                weight="regular"
                className="shrink-0 text-[#6E7771]"
                aria-hidden="true"
              />
              <label htmlFor="pretend-stock-search" className="sr-only">
                Search any NSE or BSE stock for 10-year pretend money timeline
              </label>
              <input
                id="pretend-stock-search"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search any NSE / BSE stock (e.g., RELIANCE, TCS, WIPRO, HDFCBANK, ITC)..."
                className="h-8 w-full bg-transparent text-[13.5px] text-[#161A18] placeholder:text-[#6E7771] focus:outline-none"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    setDebouncedSearch("");
                  }}
                  className="cursor-pointer text-[12px] font-medium text-[#6E7771] hover:text-[#161A18]"
                >
                  Clear
                </button>
              )}
            </div>

            {debouncedSearch.length >= 2 && (
              <div
                role="listbox"
                aria-label="Stock search matches for 10-year timeline"
                className="absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-[rgba(22,26,24,0.1)] bg-white/96 shadow-[0_18px_40px_-10px_rgba(22,26,24,0.14)] backdrop-blur-xl"
              >
                {searchQuery.isLoading ? (
                  <div className="p-3 text-[13px] text-[#6E7771]">
                    Searching NSE / BSE equities...
                  </div>
                ) : (searchQuery.data ?? []).length === 0 ? (
                  <div className="p-3 text-[13px] text-[#6E7771]">
                    No matching NSE or BSE stock found for “{debouncedSearch}”.
                  </div>
                ) : (
                  <ul className="m-0 max-h-56 list-none divide-y divide-[rgba(22,26,24,0.06)] overflow-y-auto p-0">
                    {(searchQuery.data ?? []).map((item) => (
                      <li key={`${item.ticker}-${item.exchange}`}>
                        <button
                          type="button"
                          onClick={() => handleSelectSearchItem(item)}
                          className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-[#E6F2EC]/60"
                        >
                          <div>
                            <span className="font-semibold text-[#161A18]">{item.ticker}</span>{" "}
                            <span className="text-[12px] text-[#4A524D]">{item.company_name}</span>
                          </div>
                          <span className="rounded-md bg-[#EFECE6] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#4A524D]">
                            {item.exchange}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Quick Stock Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {POPULAR_10Y_STOCKS.map((s) => {
              const active = selectedTicker === s.ticker;
              return (
                <button
                  key={s.ticker}
                  type="button"
                  onClick={() => handleSelectStock(s.ticker)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                    active
                      ? "bg-[#1F4D3A] text-white shadow-sm"
                      : "border border-[rgba(22,26,24,0.1)] bg-white/80 text-[#4A524D] hover:bg-[#E6F2EC]/60 hover:text-[#1F4D3A]"
                  }`}
                >
                  {s.ticker}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* Right 5 cols: Pretend Wallet Capital & Stop-Loss Discipline Choice */}
        <GlassCard compact className="space-y-2.5 !p-4 xl:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-semibold tracking-[0.04em] text-[#4A524D] uppercase">
              2. Pretend Wallet &amp; Stop-Loss Discipline
            </span>
            <span className="tabular-nums-lining rounded-full bg-[#FDF3E4] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#9A5B13]">
              Fake Cash Remaining: {formatInr(remainingWalletCash)}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pretend-wallet-preset"
                className="mb-1 block text-[11.5px] font-semibold text-[#4A524D]"
              >
                Starting Fake Money Wallet
              </label>
              <div className="flex flex-wrap gap-1">
                {WALLET_PRESETS_INR.map((amt) => {
                  const active = startingWalletInr === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleChangeWalletSize(amt)}
                      className={`tabular-nums-lining cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all ${
                        active
                          ? "bg-[#161A18] text-white"
                          : "border border-[rgba(22,26,24,0.12)] bg-white text-[#4A524D] hover:bg-[#FAF8F4]"
                      }`}
                    >
                      {amt >= 100_000 ? `₹${amt / 100_000}L` : `₹${amt / 1_000}k`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="pretend-stop-loss-select"
                className="mb-1 block text-[11.5px] font-semibold text-[#4A524D]"
              >
                Stop-Loss Rule Choice
              </label>
              <select
                id="pretend-stop-loss-select"
                value={stopLossPct === null ? "NONE" : String(stopLossPct)}
                onChange={(e) =>
                  setStopLossPct(e.target.value === "NONE" ? null : Number(e.target.value))
                }
                className="h-9 w-full rounded-xl border border-[rgba(22,26,24,0.14)] bg-white px-2.5 text-[12.5px] font-medium text-[#161A18] focus:border-[#4A7C64] focus:outline-none"
              >
                {STOP_LOSS_OPTIONS.map((opt) => (
                  <option
                    key={opt.value === null ? "NONE" : opt.value}
                    value={opt.value === null ? "NONE" : String(opt.value)}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Wallet Deployment Progress Bar */}
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[11.5px] text-[#4A524D]">
              <span>
                Deployed on 10Y Timeline:{" "}
                <strong className="tabular-nums-lining text-[#161A18]">
                  {formatInr(totalAllocatedSoFar)}
                </strong>{" "}
                ({tranches.length} choice{tranches.length === 1 ? "" : "s"})
              </span>
              <span className="tabular-nums-lining">
                {startingWalletInr > 0
                  ? `${Math.round((totalAllocatedSoFar / startingWalletInr) * 100)}% allocated`
                  : "0%"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFECE6]">
              <div
                className="h-full rounded-full bg-[#3B8E6A] transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    startingWalletInr > 0 ? (totalAllocatedSoFar / startingWalletInr) * 100 : 0
                  )}%`,
                }}
              />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main Interactive 10-Year Stock Timeline & Allocation Controls */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Left 8 cols: Interactive 10-Year Chart + Time-Travel Evaluation Scrubber */}
        <GlassCard className="space-y-3.5 xl:col-span-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <ChartLineUp
                  size={20}
                  weight="duotone"
                  className="text-[#1F4D3A]"
                  aria-hidden="true"
                />
                <h2 className="m-0 text-[17.5px] font-semibold tracking-[-0.015em] text-[#161A18]">
                  10-Year Historical Timeline · {timelineMeta?.company_name ?? selectedTicker}
                </h2>
              </div>
              <p className="mt-0.5 mb-0 text-[12.5px] text-[#4A524D]">
                Click any date on the 10-year chart to select an entry date (or toggle{" "}
                <strong>Instant Allocate on Click</strong> to drop fake money directly onto the
                curve).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Click behavior mode toggle */}
              <div
                role="group"
                aria-label="Chart click behavior"
                className="inline-flex rounded-full bg-[#F3F0EA] p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setChartClickMode("SELECT_DATE")}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                    chartClickMode === "SELECT_DATE"
                      ? "bg-white text-[#161A18] shadow-xs"
                      : "text-[#4A524D]"
                  }`}
                >
                  Click Selects Date
                </button>
                <button
                  type="button"
                  onClick={() => setChartClickMode("INSTANT_ALLOCATE")}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                    chartClickMode === "INSTANT_ALLOCATE"
                      ? "bg-[#1F4D3A] text-white shadow-xs"
                      : "text-[#4A524D]"
                  }`}
                >
                  Instant Allocate on Click
                </button>
              </div>

              {/* 1Y / 3Y / 5Y / 10Y Zoom Window */}
              <div
                role="group"
                aria-label="10-year timeline zoom window"
                className="inline-flex rounded-full bg-[#F3F0EA] p-0.5"
              >
                {(["1Y", "3Y", "5Y", "10Y"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setZoomWindow(w)}
                    className={`cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                      zoomWindow === w
                        ? "bg-white text-[#161A18] shadow-xs"
                        : "text-[#4A524D] hover:text-[#161A18]"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 10-Year Historical Milestone Quick-Jump Pills */}
          {timelineMeta && timelineMeta.milestones.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[rgba(22,26,24,0.07)] bg-[#FAF8F4] px-3 py-2">
              <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#4A524D]">
                <MapPin size={14} weight="duotone" className="text-[#9A5B13]" aria-hidden="true" />
                <span>10Y Historical Landmarks:</span>
              </span>
              {timelineMeta.milestones.map((ms) => {
                const isSelected = selectedEntryBar?.trading_date === ms.trading_date;
                return (
                  <button
                    key={`${ms.kind}-${ms.trading_date}`}
                    type="button"
                    title={ms.description}
                    onClick={() => handleMilestoneClick(ms)}
                    className={`tabular-nums-lining cursor-pointer rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-all ${
                      isSelected
                        ? "border-[#9A5B13] bg-[#FDF3E4] text-[#9A5B13]"
                        : "border-[rgba(22,26,24,0.1)] bg-white text-[#4A524D] hover:border-[#4A7C64] hover:text-[#1F4D3A]"
                    }`}
                  >
                    {ms.label} ({ms.trading_date.slice(0, 7)} · ₹{ms.close})
                  </button>
                );
              })}
            </div>
          )}

          {/* Chart Canvas */}
          {timelineQuery.isLoading ? (
            <div
              aria-label="Loading 10-year historical timeline"
              className="skeleton-shimmer h-[310px] w-full rounded-2xl"
            />
          ) : visibleSeries.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(22,26,24,0.09)] bg-[#F3F0EA]/70 p-6 text-[13.5px] text-[#4A524D]">
              <StatusBadge tone="unverified" label="Could not verify" />
              <p className="mt-2 mb-0">
                Could not load a 10-year historical timeline for {selectedTicker}.
              </p>
            </div>
          ) : (
            <div className="h-[310px] w-full rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/90 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={visibleSeries}
                  margin={{ top: 12, right: 14, left: 0, bottom: 0 }}
                  onClick={(chartState) => {
                    const clickedDate =
                      typeof chartState?.activeLabel === "string"
                        ? chartState.activeLabel
                        : undefined;
                    if (!clickedDate) return;
                    setSelectedEntryDate(clickedDate);
                    if (chartClickMode === "INSTANT_ALLOCATE" && remainingWalletCash >= 500) {
                      handleAddAllocationOnDate(clickedDate);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="pretend10yFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B8E6A" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#3B8E6A" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(22,26,24,0.06)" vertical={false} />
                  <XAxis
                    dataKey="trading_date"
                    tick={{ fontSize: 11, fill: "#6E7771" }}
                    tickFormatter={(d: string) => d.slice(0, 7)}
                    minTickGap={34}
                  />
                  <YAxis
                    yAxisId="price"
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#6E7771" }}
                    tickFormatter={(v: number) => `₹${v}`}
                    width={62}
                  />
                  <YAxis yAxisId="vol" orientation="right" hide domain={[0, "dataMax * 4"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(22,26,24,0.12)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    yAxisId="vol"
                    dataKey="volume"
                    fill="#A7B8B0"
                    fillOpacity={0.28}
                    name="Weekly Volume"
                  />
                  <Area
                    yAxisId="price"
                    type="monotone"
                    dataKey="close"
                    stroke="#1F4D3A"
                    strokeWidth={2.2}
                    fill="url(#pretend10yFill)"
                    name="Stock Close"
                  />
                  {/* Selected Entry Date Vertical Marker */}
                  {selectedEntryBar && (
                    <ReferenceLine
                      yAxisId="price"
                      x={selectedEntryBar.trading_date}
                      stroke="#9A5B13"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  {/* Evaluation Scrubber Date Vertical Marker */}
                  {evaluationDate && (
                    <ReferenceLine
                      yAxisId="price"
                      x={evaluationDate}
                      stroke="#1F4D3A"
                      strokeWidth={2}
                    />
                  )}
                  {/* Pins for every user-placed pretend money tranche */}
                  {[...tranchePinsByDate.entries()].map(([date, pin]) => (
                    <ReferenceDot
                      key={date}
                      yAxisId="price"
                      x={date}
                      y={pin.close}
                      r={7}
                      fill={pin.stoppedOut ? "#9A5B13" : "#1F4D3A"}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Interactive 10-Year Evaluation Date Scrubber ("Time-Travel Slider") */}
          {fullSeries.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-[rgba(22,26,24,0.09)] bg-[#FAF8F4] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders size={17} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
                  <label
                    htmlFor="evaluation-date-scrubber"
                    className="text-[13px] font-semibold text-[#161A18]"
                  >
                    Time-Travel Evaluation Cursor:{" "}
                    <span className="tabular-nums-lining rounded-md bg-[#E6F2EC] px-2 py-0.5 text-[#1F4D3A]">
                      {evaluationDate}
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStepEvaluationTimeline(26)}
                    disabled={effectiveEvalIndex >= fullSeries.length - 1}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[rgba(22,26,24,0.12)] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#161A18] hover:bg-[#E6F2EC]/50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FastForward size={13} weight="bold" aria-hidden="true" />
                    <span>+6 Months</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepEvaluationTimeline(52)}
                    disabled={effectiveEvalIndex >= fullSeries.length - 1}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[rgba(22,26,24,0.12)] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#161A18] hover:bg-[#E6F2EC]/50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FastForward size={13} weight="bold" aria-hidden="true" />
                    <span>+1 Year</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvalBarIndex(fullSeries.length - 1)}
                    disabled={effectiveEvalIndex >= fullSeries.length - 1}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#1F4D3A] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-[#16382A] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span>Latest Date ({timelineMeta?.end_date})</span>
                  </button>
                </div>
              </div>

              <input
                id="evaluation-date-scrubber"
                type="range"
                min={0}
                max={Math.max(0, fullSeries.length - 1)}
                value={effectiveEvalIndex}
                onChange={(e) => setEvalBarIndex(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-[#1F4D3A]"
              />

              <div className="tabular-nums-lining flex items-center justify-between text-[11px] text-[#6E7771]">
                <span>10Y Start: {fullSeries[0]?.trading_date}</span>
                <span>
                  Stock Close on {evaluationDate}:{" "}
                  <strong className="text-[#161A18]">
                    {formatInr(fullSeries[effectiveEvalIndex]?.close, 2)}
                  </strong>
                </span>
                <span>Latest: {fullSeries[fullSeries.length - 1]?.trading_date}</span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Right 4 cols: Apply Fake Money at Selected Point + Real-World Choice Scenarios */}
        <GlassCard className="flex flex-col justify-between space-y-4 xl:col-span-4">
          <div className="space-y-3.5">
            <div>
              <h2 className="m-0 text-[16.5px] font-semibold tracking-[-0.015em] text-[#161A18]">
                3. Apply Fake Money on Timeline
              </h2>
              <p className="mt-0.5 mb-0 text-[12.5px] text-[#4A524D]">
                Deploy pretend money on your selected historical date or test a real-world retail
                scenario below.
              </p>
            </div>

            {/* Selected Historical Entry Point Box */}
            <div className="space-y-2.5 rounded-2xl border border-[rgba(22,26,24,0.1)] bg-[#FAF8F4] p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#4A524D]">
                  <CalendarBlank size={15} weight="duotone" className="text-[#9A5B13]" />
                  <span>Selected Entry Date</span>
                </span>
                <span className="tabular-nums-lining rounded-md bg-[#FDF3E4] px-2 py-0.5 text-[12px] font-bold text-[#9A5B13]">
                  {selectedEntryBar?.trading_date ?? "—"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-white p-2.5">
                  <span className="block text-[11px] text-[#6E7771]">Historical Stock Close</span>
                  <strong className="tabular-nums-lining text-[14.5px] text-[#161A18]">
                    {formatInr(selectedEntryBar?.close, 2)}
                  </strong>
                </div>
                <div className="rounded-xl bg-white p-2.5">
                  <span className="block text-[11px] text-[#6E7771]">NIFTY 50 Same Date</span>
                  <strong className="tabular-nums-lining text-[14.5px] text-[#4E5964]">
                    {selectedEntryBar?.benchmark_close.toLocaleString("en-IN") ?? "—"}
                  </strong>
                </div>
              </div>

              {/* Date Slider / Picker within 10Y */}
              <div>
                <label
                  htmlFor="entry-date-index-slider"
                  className="mb-1 block text-[11.5px] font-medium text-[#4A524D]"
                >
                  Scrub Entry Date Along 10-Year Timeline
                </label>
                <input
                  id="entry-date-index-slider"
                  type="range"
                  min={0}
                  max={Math.max(0, fullSeries.length - 1)}
                  value={Math.max(
                    0,
                    fullSeries.findIndex(
                      (b) => b.trading_date === selectedEntryBar?.trading_date
                    )
                  )}
                  onChange={(e) => {
                    const bar = fullSeries[Number(e.target.value)];
                    if (bar) setSelectedEntryDate(bar.trading_date);
                  }}
                  className="h-2 w-full cursor-pointer accent-[#9A5B13]"
                />
              </div>

              {/* Amount to Apply */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="pretend-tranche-amount"
                    className="text-[12px] font-semibold text-[#161A18]"
                  >
                    Fake Money to Apply on {selectedEntryBar?.trading_date}
                  </label>
                  <span className="tabular-nums-lining text-[11px] text-[#6E7771]">
                    Max: {formatInr(remainingWalletCash)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="pretend-tranche-amount"
                    type="number"
                    min={500}
                    max={Math.max(500, remainingWalletCash)}
                    step={500}
                    value={allocationAmountInr}
                    onChange={(e) => setAllocationAmountInr(Number(e.target.value))}
                    className="tabular-nums-lining h-9 w-full rounded-xl border border-[rgba(22,26,24,0.15)] bg-white px-3 text-[13.5px] font-semibold text-[#161A18] focus:border-[#4A7C64] focus:outline-none"
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[0.25, 0.5, 1].map((pct) => {
                    const suggested = Math.max(
                      500,
                      Math.round(remainingWalletCash * pct)
                    );
                    return (
                      <button
                        key={pct}
                        type="button"
                        disabled={remainingWalletCash <= 0}
                        onClick={() => setAllocationAmountInr(suggested)}
                        className="cursor-pointer rounded-md border border-[rgba(22,26,24,0.1)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4A524D] hover:bg-[#E6F2EC] hover:text-[#1F4D3A] disabled:opacity-40"
                      >
                        {pct === 1 ? "All Remaining Cash" : `${pct * 100}% of Remaining`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={() => handleAddAllocationOnDate()}
                disabled={remainingWalletCash <= 0 || !selectedEntryBar}
                className="w-full justify-center"
              >
                <Plus size={16} weight="bold" aria-hidden="true" />
                <span>
                  {remainingWalletCash <= 0
                    ? "Pretend Wallet Fully Allocated"
                    : `Apply ${formatInr(Math.min(remainingWalletCash, allocationAmountInr))} on ${selectedEntryBar?.trading_date ?? ""}`}
                </span>
              </Button>
            </div>

            {/* One-Click Real-World 10Y Scenario Presets */}
            <div className="space-y-2">
              <span className="block text-[11.5px] font-semibold tracking-[0.04em] text-[#4A524D] uppercase">
                One-Click 10-Year Choice Scenarios
              </span>
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() => applyScenarioPreset("LUMP_SUM_10Y_START")}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-[rgba(22,26,24,0.1)] bg-white/85 px-3 py-2 text-left text-[12.5px] transition-colors hover:border-[#4A7C64] hover:bg-[#E6F2EC]/45"
                >
                  <div>
                    <strong className="block text-[#161A18]">100% Lump Sum 10 Years Ago</strong>
                    <span className="text-[11px] text-[#6E7771]">
                      Apply full wallet on {fullSeries[0]?.trading_date ?? "start date"}
                    </span>
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-[#4A7C64]" />
                </button>

                <button
                  type="button"
                  onClick={() => applyScenarioPreset("CHASED_RUNUP_PEAK")}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-[rgba(22,26,24,0.1)] bg-white/85 px-3 py-2 text-left text-[12.5px] transition-colors hover:border-[#9A5B13] hover:bg-[#FDF3E4]/55"
                >
                  <div>
                    <strong className="block text-[#9A5B13]">
                      Chased a Sharp Pre-Tip Run-Up Peak
                    </strong>
                    <span className="text-[11px] text-[#6E7771]">
                      Tests drawdown risk of entering right after a 4-week spike
                    </span>
                  </div>
                  <WarningCircle size={15} className="shrink-0 text-[#9A5B13]" />
                </button>

                <button
                  type="button"
                  onClick={() => applyScenarioPreset("YEARLY_STAGGERED_10Y")}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-[rgba(22,26,24,0.1)] bg-white/85 px-3 py-2 text-left text-[12.5px] transition-colors hover:border-[#4A7C64] hover:bg-[#E6F2EC]/45"
                >
                  <div>
                    <strong className="block text-[#161A18]">
                      Yearly Staggered Tranches (10 × 10%)
                    </strong>
                    <span className="text-[11px] text-[#6E7771]">
                      Spreads pretend money evenly across all 10 years
                    </span>
                  </div>
                  <ClockCounterClockwise size={15} className="shrink-0 text-[#4A7C64]" />
                </button>

                <button
                  type="button"
                  onClick={() => applyScenarioPreset("DIP_AND_RECOVERY")}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-[rgba(22,26,24,0.1)] bg-white/85 px-3 py-2 text-left text-[12.5px] transition-colors hover:border-[#4A7C64] hover:bg-[#E6F2EC]/45"
                >
                  <div>
                    <strong className="block text-[#161A18]">
                      3-Part Pullback &amp; Recovery Split
                    </strong>
                    <span className="text-[11px] text-[#6E7771]">
                      30% start · 40% deepest pullback trough · 30% mid-cycle
                    </span>
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-[#4A7C64]" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#F3F0EA]/80 px-3 py-2 text-[11.5px] text-[#4A524D]">
            <Info size={14} weight="duotone" className="mr-1 inline text-[#1F4D3A]" />
            Zero login, zero persistence: your pretend wallet and choices exist only in active
            browser memory and clear on reset.
          </div>
        </GlassCard>
      </div>

      {/* 4-Column Deterministic 10-Year Outcome Ledger Cards */}
      {evalData && (
        <section
          aria-label="Pretend money 10-year historical outcome summary"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {/* Card 1: Pretend Portfolio Value at Evaluation Date */}
          <GlassCard compact className="space-y-1.5 !p-4">
            <span className="text-[11.5px] font-semibold tracking-[0.04em] text-[#6E7771] uppercase">
              Pretend Portfolio on {evalData.evaluation_date}
            </span>
            <p className="tabular-nums-lining m-0 text-[22px] font-bold tracking-[-0.02em] text-[#161A18]">
              {formatInr(evalData.total_portfolio_value_inr)}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span
                className={`tabular-nums-lining rounded-full px-2 py-0.5 font-semibold ${
                  evalData.total_net_change_inr >= 0
                    ? "bg-[#E6F2EC] text-[#1F4D3A]"
                    : "bg-[#FDF3E4] text-[#9A5B13]"
                }`}
              >
                {formatSignedPct(evalData.total_return_pct)} (
                {evalData.total_net_change_inr >= 0 ? "+" : ""}
                {formatInr(evalData.total_net_change_inr)})
              </span>
              {evalData.portfolio_cagr_pct !== null && (
                <span className="tabular-nums-lining text-[#6E7771]">
                  CAGR: <strong>{formatSignedPct(evalData.portfolio_cagr_pct)}</strong>
                </span>
              )}
            </div>
          </GlassCard>

          {/* Card 2: Same Fake Money in NIFTY 50 Benchmark */}
          <GlassCard compact className="space-y-1.5 !p-4">
            <span className="text-[11.5px] font-semibold tracking-[0.04em] text-[#6E7771] uppercase">
              Same Dates in NIFTY 50 Index
            </span>
            <p className="tabular-nums-lining m-0 text-[22px] font-bold tracking-[-0.02em] text-[#4E5964]">
              {formatInr(evalData.nifty_equivalent_portfolio_inr)}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-1 text-[12px] text-[#4A524D]">
              <span className="tabular-nums-lining font-semibold">
                Index: {formatSignedPct(evalData.nifty_equivalent_return_pct)}
              </span>
              <span className="tabular-nums-lining text-[11.5px] text-[#6E7771]">
                6.5% Fixed Ref: {formatInr(evalData.fixed_reference_portfolio_inr)}
              </span>
            </div>
          </GlassCard>

          {/* Card 3: Maximum Historical Post-Entry Drawdown */}
          <GlassCard compact className="space-y-1.5 !p-4">
            <span className="text-[11.5px] font-semibold tracking-[0.04em] text-[#6E7771] uppercase">
              Steepest Post-Entry Drawdown
            </span>
            <p className="tabular-nums-lining m-0 text-[22px] font-bold tracking-[-0.02em] text-[#9A5B13]">
              -{evalData.worst_tranche_drawdown_pct.toFixed(2)}%
            </p>
            <p className="m-0 text-[12px] text-[#4A524D]">
              {evalData.worst_drawdown_date
                ? `Deepest trough observed on ${evalData.worst_drawdown_date}`
                : "No post-entry drawdown recorded"}
            </p>
          </GlassCard>

          {/* Card 4: Cash & Stop-Loss Protection Status */}
          <GlassCard compact className="space-y-1.5 !p-4">
            <span className="text-[11.5px] font-semibold tracking-[0.04em] text-[#6E7771] uppercase">
              Cash &amp; Stop-Loss Discipline
            </span>
            <p className="tabular-nums-lining m-0 text-[22px] font-bold tracking-[-0.02em] text-[#161A18]">
              {formatInr(evalData.unallocated_cash_inr + evalData.stopped_out_cash_inr)}
            </p>
            <p className="m-0 text-[12px] text-[#4A524D]">
              {evalData.stop_loss_pct === null
                ? "No stop-loss active (unprotected exposure)"
                : `${evalData.stop_loss_pct}% rule · ${evalData.stopped_out_tranche_count} tranche(s) stopped into cash`}
            </p>
          </GlassCard>
        </section>
      )}

      {/* Portfolio Equity Curve vs NIFTY 50 + Guarded Educational Takeaways */}
      {evalData && (
        <div className="grid gap-4 xl:grid-cols-12">
          {/* Left 7 cols: Pretend Portfolio Value Curve vs NIFTY 50 Equivalence */}
          <GlassCard className="space-y-3 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-[16px] font-semibold text-[#161A18]">
                  Pretend Wallet Growth Curve vs. Same-Date NIFTY 50 Baseline
                </h3>
                <p className="mt-0.5 mb-0 text-[12px] text-[#4A524D]">
                  Compares your pretend money choices in {evalData.ticker} (Forest Sage) against
                  putting the exact same amounts on the exact same dates into NIFTY 50 (Slate).
                </p>
              </div>
            </div>

            <div className="h-[235px] w-full rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/90 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={evalData.equity_curve}
                  margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(22,26,24,0.06)" vertical={false} />
                  <XAxis
                    dataKey="trading_date"
                    tick={{ fontSize: 11, fill: "#6E7771" }}
                    tickFormatter={(d: string) => d.slice(0, 7)}
                    minTickGap={32}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#6E7771" }}
                    tickFormatter={(v: number) =>
                      v >= 100_000 ? `₹${(v / 100_000).toFixed(1)}L` : `₹${Math.round(v / 1000)}k`
                    }
                    width={64}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(22,26,24,0.12)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="portfolio_value_inr"
                    stroke="#1F4D3A"
                    strokeWidth={2.4}
                    dot={false}
                    name={`${evalData.ticker} Pretend Portfolio`}
                  />
                  <Line
                    type="monotone"
                    dataKey="nifty_equivalent_inr"
                    stroke="#4E5964"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    name="Same Dates in NIFTY 50"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Right 5 cols: Output-Guarded Historical Evidence Takeaways */}
          <GlassCard className="flex flex-col justify-between space-y-3 xl:col-span-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    size={20}
                    weight="duotone"
                    className="text-[#1F4D3A]"
                    aria-hidden="true"
                  />
                  <h3 className="m-0 text-[16px] font-semibold text-[#161A18]">
                    Guarded Historical Evidence Takeaways
                  </h3>
                </div>
                <StatusBadge
                  tone="neutral_ok"
                  label={
                    evalData.guard_status === "PASSED"
                      ? "Output Guard Verified"
                      : "Safe Fallback Active"
                  }
                />
              </div>

              <div className="space-y-2.5">
                {evalData.observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-white/85 p-3"
                  >
                    <p className="m-0 text-[12px] font-semibold text-[#1F4D3A]">{obs.title}</p>
                    <p className="mt-1 mb-0 text-[12.5px] leading-relaxed text-[#161A18]">
                      {obs.sentence}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(22,26,24,0.09)] bg-[#FAF8F4] p-3 text-[11.5px] leading-relaxed text-[#4A524D]">
              <strong>Mandatory Disclaimer:</strong> {evalData.mandatory_disclaimer}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Tranche-by-Tranche Allocation Ledger Table */}
      <GlassCard className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="m-0 text-[16px] font-semibold text-[#161A18]">
              Your Pretend Money Timeline Choices ({evalData?.tranches.length ?? 0})
            </h3>
            <p className="mt-0.5 mb-0 text-[12px] text-[#4A524D]">
              Every historical choice evaluated through{" "}
              <strong className="tabular-nums-lining">{evalData?.evaluation_date ?? "—"}</strong>{" "}
              alongside its steepest post-entry drawdown and same-date NIFTY 50 benchmark outcome.
            </p>
          </div>
        </div>

        {!evalData || evalData.tranches.length === 0 ? (
          <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4] p-5 text-center text-[13px] text-[#4A524D]">
            No pretend money allocations placed yet. Click any date on the 10-year timeline chart or
            pick a one-click scenario above to apply fake money.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[rgba(22,26,24,0.09)] bg-[#FAF8F4] text-[11px] font-semibold tracking-[0.04em] text-[#4A524D] uppercase">
                  <th className="px-3.5 py-2.5">Choice &amp; Entry Date</th>
                  <th className="px-3 py-2.5">Fake Money Applied</th>
                  <th className="px-3 py-2.5">Entry → Eval Price</th>
                  <th className="px-3 py-2.5">Timeline Status</th>
                  <th className="px-3 py-2.5">Value on Eval Date</th>
                  <th className="px-3 py-2.5">Max Drawdown</th>
                  <th className="px-3 py-2.5">Same Date in NIFTY 50</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(22,26,24,0.06)]">
                {evalData.tranches.map((tr) => (
                  <tr key={tr.id} className="hover:bg-white/75">
                    <td className="px-3.5 py-2.5">
                      <strong className="block text-[#161A18]">{tr.label}</strong>
                      <span className="tabular-nums-lining text-[11.5px] text-[#6E7771]">
                        Entered {tr.actual_entry_date} ({tr.holding_days} days held)
                      </span>
                    </td>
                    <td className="tabular-nums-lining px-3 py-2.5 font-semibold text-[#161A18]">
                      {formatInr(tr.amount_inr)}
                    </td>
                    <td className="tabular-nums-lining px-3 py-2.5 text-[#4A524D]">
                      {formatInr(tr.entry_price, 2)} → {formatInr(tr.eval_price, 2)}
                    </td>
                    <td className="px-3 py-2.5">
                      {tr.status === "STOP_LOSS_TRIGGERED" ? (
                        <StatusBadge
                          tone="attention"
                          label={`Stopped Out on ${tr.stopped_out_date}`}
                        />
                      ) : tr.status === "AFTER_EVAL_DATE" ? (
                        <StatusBadge tone="unverified" label="After Eval Cursor Date" />
                      ) : (
                        <StatusBadge tone="neutral_ok" label="Held to Evaluation Date" />
                      )}
                    </td>
                    <td className="tabular-nums-lining px-3 py-2.5">
                      <strong className="block text-[#161A18]">
                        {formatInr(tr.final_value_inr)}
                      </strong>
                      <span
                        className={`text-[11.5px] font-semibold ${
                          tr.return_pct >= 0 ? "text-[#1F4D3A]" : "text-[#9A5B13]"
                        }`}
                      >
                        {formatSignedPct(tr.return_pct)}
                        {tr.cagr_pct !== null ? ` (${formatSignedPct(tr.cagr_pct)} CAGR)` : ""}
                      </span>
                    </td>
                    <td className="tabular-nums-lining px-3 py-2.5 font-semibold text-[#9A5B13]">
                      -{tr.max_drawdown_pct.toFixed(2)}%
                      {tr.max_drawdown_date && (
                        <span className="block text-[11px] font-normal text-[#6E7771]">
                          on {tr.max_drawdown_date}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums-lining px-3 py-2.5 text-[#4E5964]">
                      <strong className="block">{formatInr(tr.benchmark_final_value_inr)}</strong>
                      <span className="text-[11.5px]">
                        {formatSignedPct(tr.benchmark_return_pct)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${tr.label}`}
                        onClick={() => handleRemoveTranche(tr.id)}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[rgba(22,26,24,0.1)] bg-white text-[#6E7771] hover:border-[#9A5B13] hover:text-[#9A5B13]"
                      >
                        <Trash size={14} weight="regular" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
