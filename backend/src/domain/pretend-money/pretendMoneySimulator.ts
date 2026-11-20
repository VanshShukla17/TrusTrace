import { Decimal } from "decimal.js";
import { MANDATORY_DISCLAIMER, scanSystemAuthoredText } from "../output-guard/guard.js";

export interface TenYearTimelinePoint {
  trading_date: string;
  close: number;
  volume: number | null;
  benchmark_close: number;
}

export interface TenYearMilestone {
  kind: "TEN_YEAR_START" | "TEN_YEAR_LOW" | "TEN_YEAR_HIGH" | "SHARPEST_RUNUP_PEAK" | "DEEPEST_DRAWDOWN_TROUGH";
  label: string;
  trading_date: string;
  close: number;
  description: string;
}

export interface PretendTrancheInput {
  id: string;
  entry_date: string;
  amount_inr: number;
  label?: string;
}

export interface EvaluatedTrancheResult {
  id: string;
  label: string;
  requested_entry_date: string;
  actual_entry_date: string;
  amount_inr: number;
  entry_price: number;
  units_allocated: number;
  status: "ACTIVE_AT_EVAL" | "STOP_LOSS_TRIGGERED" | "AFTER_EVAL_DATE";
  stopped_out_date: string | null;
  stopped_out_price: number | null;
  eval_date: string;
  eval_price: number;
  final_value_inr: number;
  net_change_inr: number;
  return_pct: number;
  holding_days: number;
  cagr_pct: number | null;
  peak_value_inr: number;
  trough_value_inr: number;
  max_drawdown_pct: number;
  max_drawdown_date: string | null;
  benchmark_entry_close: number;
  benchmark_eval_close: number;
  benchmark_final_value_inr: number;
  benchmark_return_pct: number;
  fixed_reference_final_value_inr: number;
}

export interface PretendPortfolioCurvePoint {
  trading_date: string;
  stock_close: number;
  deployed_capital_inr: number;
  portfolio_value_inr: number;
  nifty_equivalent_inr: number;
}

export interface GuardedPretendObservation {
  id: string;
  title: string;
  sentence: string;
  guard_passed: boolean;
}

export interface PretendMoneyEvaluationResult {
  ticker: string;
  company_name: string;
  starting_wallet_inr: number;
  evaluation_date: string;
  stop_loss_pct: number | null;
  total_allocated_inr: number;
  unallocated_cash_inr: number;
  stopped_out_cash_inr: number;
  active_equity_value_inr: number;
  total_portfolio_value_inr: number;
  total_net_change_inr: number;
  total_return_pct: number;
  portfolio_cagr_pct: number | null;
  worst_tranche_drawdown_pct: number;
  worst_drawdown_date: string | null;
  stopped_out_tranche_count: number;
  nifty_equivalent_portfolio_inr: number;
  nifty_equivalent_return_pct: number;
  fixed_reference_portfolio_inr: number;
  tranches: EvaluatedTrancheResult[];
  equity_curve: PretendPortfolioCurvePoint[];
  guard_status: "PASSED" | "BLOCKED_FALLBACK";
  observations: GuardedPretendObservation[];
  mandatory_disclaimer: string;
}

const FIXED_REFERENCE_ANNUAL_RATE = 0.065; // 6.5% p.a. historical savings/deposit reference

function daysBetweenIsoDates(startIso: string, endIso: string): number {
  const startMs = Date.parse(`${startIso}T00:00:00Z`);
  const endMs = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }
  return Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
}

function findNearestOnOrAfterPoint(
  series: TenYearTimelinePoint[],
  targetDate: string
): { point: TenYearTimelinePoint; index: number } {
  for (let i = 0; i < series.length; i += 1) {
    if (series[i]!.trading_date >= targetDate) {
      return { point: series[i]!, index: i };
    }
  }
  const lastIndex = series.length - 1;
  return { point: series[lastIndex]!, index: lastIndex };
}

function findNearestOnOrBeforePoint(
  series: TenYearTimelinePoint[],
  targetDate: string
): { point: TenYearTimelinePoint; index: number } {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i]!.trading_date <= targetDate) {
      return { point: series[i]!, index: i };
    }
  }
  return { point: series[0]!, index: 0 };
}

function sanitizeObservation(id: string, title: string, candidate: string): GuardedPretendObservation {
  const scan = scanSystemAuthoredText(candidate);
  if (!scan.passed) {
    return {
      id,
      title,
      sentence:
        "A summary observation did not pass the non-advisory Output Guard and was withheld. Inspect the dated historical series directly.",
      guard_passed: false,
    };
  }
  return {
    id,
    title,
    sentence: candidate,
    guard_passed: true,
  };
}

/**
 * Deterministically evaluates user-placed pretend money tranches along a 10-year historical
 * stock and NIFTY 50 timeline using decimal.js arithmetic.
 */
export function evaluatePretendMoneyTimeline(params: {
  ticker: string;
  company_name: string;
  starting_wallet_inr: number;
  evaluation_date?: string;
  stop_loss_pct: number | null;
  tranches: PretendTrancheInput[];
  series: TenYearTimelinePoint[];
}): PretendMoneyEvaluationResult {
  const sortedSeries = [...params.series].sort((a, b) =>
    a.trading_date.localeCompare(b.trading_date)
  );
  if (sortedSeries.length === 0) {
    throw new Error("Cannot evaluate pretend money timeline on an empty price series.");
  }

  const walletDec = new Decimal(params.starting_wallet_inr);
  const requestedEvalDate =
    params.evaluation_date ?? sortedSeries[sortedSeries.length - 1]!.trading_date;
  const { point: evalPoint, index: evalIndex } = findNearestOnOrBeforePoint(
    sortedSeries,
    requestedEvalDate
  );
  const evalDate = evalPoint.trading_date;

  // Cap tranches so total deployed never exceeds starting_wallet_inr
  let remainingBudget = walletDec;
  const normalizedTranches: Array<{
    input: PretendTrancheInput;
    entryPoint: TenYearTimelinePoint;
    entryIndex: number;
    allocatedDec: Decimal;
  }> = [];

  for (let idx = 0; idx < params.tranches.length; idx += 1) {
    const raw = params.tranches[idx]!;
    if (raw.amount_inr <= 0 || remainingBudget.lte(0)) continue;
    const requestedDec = new Decimal(raw.amount_inr);
    const actualAmountDec = Decimal.min(requestedDec, remainingBudget);
    if (actualAmountDec.lte(0)) continue;

    const { point: entryPoint, index: entryIndex } = findNearestOnOrAfterPoint(
      sortedSeries,
      raw.entry_date
    );
    remainingBudget = remainingBudget.minus(actualAmountDec);
    normalizedTranches.push({
      input: raw,
      entryPoint,
      entryIndex,
      allocatedDec: actualAmountDec,
    });
  }

  const evaluatedTranches: EvaluatedTrancheResult[] = [];
  let totalAllocatedDec = new Decimal(0);
  let stoppedOutCashDec = new Decimal(0);
  let activeEquityValueDec = new Decimal(0);
  let niftyActiveAndAllocatedDec = new Decimal(0);
  let fixedReferenceAllocatedDec = new Decimal(0);
  let worstDrawdownPct = 0;
  let worstDrawdownDate: string | null = null;
  let earliestActiveEntryDate: string | null = null;
  let stoppedOutCount = 0;

  for (let i = 0; i < normalizedTranches.length; i += 1) {
    const item = normalizedTranches[i]!;
    const label = item.input.label?.trim() || `Allocation #${i + 1}`;
    const entryPriceDec = new Decimal(item.entryPoint.close);
    const unitsDec = item.allocatedDec.div(entryPriceDec);
    const benchEntryDec = new Decimal(item.entryPoint.benchmark_close);
    const benchUnitsDec = item.allocatedDec.div(benchEntryDec);

    if (item.entryIndex > evalIndex) {
      // Tranche was placed after the current evaluation scrubber date
      evaluatedTranches.push({
        id: item.input.id,
        label,
        requested_entry_date: item.input.entry_date,
        actual_entry_date: item.entryPoint.trading_date,
        amount_inr: Number(item.allocatedDec.toFixed(2)),
        entry_price: Number(entryPriceDec.toFixed(2)),
        units_allocated: Number(unitsDec.toFixed(4)),
        status: "AFTER_EVAL_DATE",
        stopped_out_date: null,
        stopped_out_price: null,
        eval_date: evalDate,
        eval_price: evalPoint.close,
        final_value_inr: Number(item.allocatedDec.toFixed(2)),
        net_change_inr: 0,
        return_pct: 0,
        holding_days: 0,
        cagr_pct: null,
        peak_value_inr: Number(item.allocatedDec.toFixed(2)),
        trough_value_inr: Number(item.allocatedDec.toFixed(2)),
        max_drawdown_pct: 0,
        max_drawdown_date: null,
        benchmark_entry_close: Number(benchEntryDec.toFixed(2)),
        benchmark_eval_close: Number(benchEntryDec.toFixed(2)),
        benchmark_final_value_inr: Number(item.allocatedDec.toFixed(2)),
        benchmark_return_pct: 0,
        fixed_reference_final_value_inr: Number(item.allocatedDec.toFixed(2)),
      });
      continue;
    }

    totalAllocatedDec = totalAllocatedDec.plus(item.allocatedDec);
    if (
      earliestActiveEntryDate === null ||
      item.entryPoint.trading_date < earliestActiveEntryDate
    ) {
      earliestActiveEntryDate = item.entryPoint.trading_date;
    }

    const stopThresholdPriceDec =
      params.stop_loss_pct !== null && params.stop_loss_pct > 0
        ? entryPriceDec.mul(new Decimal(1).minus(new Decimal(params.stop_loss_pct).div(100)))
        : null;

    let runningPeakPriceDec = entryPriceDec;
    let peakValueDec = item.allocatedDec;
    let troughValueDec = item.allocatedDec;
    let maxDrawdownDec = new Decimal(0);
    let maxDrawdownDateForTranche: string | null = null;
    let stoppedOutDate: string | null = null;
    let stoppedOutPriceDec: Decimal | null = null;

    for (let barIdx = item.entryIndex; barIdx <= evalIndex; barIdx += 1) {
      const bar = sortedSeries[barIdx]!;
      const barPriceDec = new Decimal(bar.close);
      const currentValDec = unitsDec.mul(barPriceDec);

      if (barPriceDec.gt(runningPeakPriceDec)) {
        runningPeakPriceDec = barPriceDec;
      }
      if (currentValDec.gt(peakValueDec)) {
        peakValueDec = currentValDec;
      }
      if (currentValDec.lt(troughValueDec)) {
        troughValueDec = currentValDec;
      }

      const ddDec = runningPeakPriceDec
        .minus(barPriceDec)
        .div(runningPeakPriceDec)
        .mul(100);
      if (ddDec.gt(maxDrawdownDec)) {
        maxDrawdownDec = ddDec;
        maxDrawdownDateForTranche = bar.trading_date;
      }

      if (
        barIdx > item.entryIndex &&
        stopThresholdPriceDec !== null &&
        barPriceDec.lte(stopThresholdPriceDec)
      ) {
        stoppedOutDate = bar.trading_date;
        stoppedOutPriceDec = barPriceDec;
        break;
      }
    }

    const effectiveExitPriceDec =
      stoppedOutPriceDec !== null ? stoppedOutPriceDec : new Decimal(evalPoint.close);
    const effectiveEndDate = stoppedOutDate ?? evalDate;
    const finalValueDec = unitsDec.mul(effectiveExitPriceDec);
    const netChangeDec = finalValueDec.minus(item.allocatedDec);
    const returnPctDec = netChangeDec.div(item.allocatedDec).mul(100);

    const holdingDays = daysBetweenIsoDates(item.entryPoint.trading_date, effectiveEndDate);
    const totalEvalDays = daysBetweenIsoDates(item.entryPoint.trading_date, evalDate);

    let cagrPct: number | null = null;
    if (holdingDays >= 180 && finalValueDec.gt(0)) {
      const years = holdingDays / 365.25;
      const ratio = finalValueDec.div(item.allocatedDec).toNumber();
      const cagr = (Math.pow(ratio, 1 / years) - 1) * 100;
      if (Number.isFinite(cagr)) {
        cagrPct = Number(cagr.toFixed(2));
      }
    }

    if (stoppedOutDate !== null) {
      stoppedOutCount += 1;
      stoppedOutCashDec = stoppedOutCashDec.plus(finalValueDec);
    } else {
      activeEquityValueDec = activeEquityValueDec.plus(finalValueDec);
    }

    const maxDdNum = Number(maxDrawdownDec.toFixed(2));
    if (maxDdNum > worstDrawdownPct) {
      worstDrawdownPct = maxDdNum;
      worstDrawdownDate = maxDrawdownDateForTranche;
    }

    const benchEvalCloseDec = new Decimal(evalPoint.benchmark_close);
    const benchFinalValDec = benchUnitsDec.mul(benchEvalCloseDec);
    const benchReturnPctDec = benchFinalValDec
      .minus(item.allocatedDec)
      .div(item.allocatedDec)
      .mul(100);
    niftyActiveAndAllocatedDec = niftyActiveAndAllocatedDec.plus(benchFinalValDec);

    const refYears = Math.max(0, totalEvalDays / 365.25);
    const fixedRefValNum =
      item.allocatedDec.toNumber() * Math.pow(1 + FIXED_REFERENCE_ANNUAL_RATE, refYears);
    const fixedRefValDec = new Decimal(fixedRefValNum);
    fixedReferenceAllocatedDec = fixedReferenceAllocatedDec.plus(fixedRefValDec);

    evaluatedTranches.push({
      id: item.input.id,
      label,
      requested_entry_date: item.input.entry_date,
      actual_entry_date: item.entryPoint.trading_date,
      amount_inr: Number(item.allocatedDec.toFixed(2)),
      entry_price: Number(entryPriceDec.toFixed(2)),
      units_allocated: Number(unitsDec.toFixed(4)),
      status: stoppedOutDate !== null ? "STOP_LOSS_TRIGGERED" : "ACTIVE_AT_EVAL",
      stopped_out_date: stoppedOutDate,
      stopped_out_price: stoppedOutPriceDec !== null ? Number(stoppedOutPriceDec.toFixed(2)) : null,
      eval_date: evalDate,
      eval_price: Number(effectiveExitPriceDec.toFixed(2)),
      final_value_inr: Number(finalValueDec.toFixed(2)),
      net_change_inr: Number(netChangeDec.toFixed(2)),
      return_pct: Number(returnPctDec.toFixed(2)),
      holding_days: holdingDays,
      cagr_pct: cagrPct,
      peak_value_inr: Number(peakValueDec.toFixed(2)),
      trough_value_inr: Number(troughValueDec.toFixed(2)),
      max_drawdown_pct: maxDdNum,
      max_drawdown_date: maxDrawdownDateForTranche,
      benchmark_entry_close: Number(benchEntryDec.toFixed(2)),
      benchmark_eval_close: Number(benchEvalCloseDec.toFixed(2)),
      benchmark_final_value_inr: Number(benchFinalValDec.toFixed(2)),
      benchmark_return_pct: Number(benchReturnPctDec.toFixed(2)),
      fixed_reference_final_value_inr: Number(fixedRefValDec.toFixed(2)),
    });
  }

  const unallocatedCashDec = walletDec.minus(totalAllocatedDec);
  const totalPortfolioValueDec = unallocatedCashDec
    .plus(stoppedOutCashDec)
    .plus(activeEquityValueDec);
  const totalNetChangeDec = totalPortfolioValueDec.minus(walletDec);
  const totalReturnPctDec = walletDec.gt(0)
    ? totalNetChangeDec.div(walletDec).mul(100)
    : new Decimal(0);

  const niftyEquivalentPortfolioDec = unallocatedCashDec.plus(niftyActiveAndAllocatedDec);
  const niftyEquivalentReturnPctDec = walletDec.gt(0)
    ? niftyEquivalentPortfolioDec.minus(walletDec).div(walletDec).mul(100)
    : new Decimal(0);

  const fixedReferencePortfolioDec = unallocatedCashDec.plus(fixedReferenceAllocatedDec);

  let portfolioCagrPct: number | null = null;
  if (earliestActiveEntryDate !== null) {
    const portfolioSpanDays = daysBetweenIsoDates(earliestActiveEntryDate, evalDate);
    if (portfolioSpanDays >= 180 && totalPortfolioValueDec.gt(0) && walletDec.gt(0)) {
      const years = portfolioSpanDays / 365.25;
      const ratio = totalPortfolioValueDec.div(walletDec).toNumber();
      const cagr = (Math.pow(ratio, 1 / years) - 1) * 100;
      if (Number.isFinite(cagr)) {
        portfolioCagrPct = Number(cagr.toFixed(2));
      }
    }
  }

  // Build sampled portfolio equity curve across the 10-year timeline up to evalIndex
  const activeNormalized = normalizedTranches.filter((t) => t.entryIndex <= evalIndex);
  const trancheStopInfo = new Map<string, { stoppedDate: string; lockedCashDec: Decimal }>();
  for (const et of evaluatedTranches) {
    if (et.status === "STOP_LOSS_TRIGGERED" && et.stopped_out_date) {
      trancheStopInfo.set(et.id, {
        stoppedDate: et.stopped_out_date,
        lockedCashDec: new Decimal(et.final_value_inr),
      });
    }
  }

  const equityCurve: PretendPortfolioCurvePoint[] = [];
  const step = Math.max(1, Math.floor((evalIndex + 1) / 140));
  for (let idx = 0; idx <= evalIndex; idx += step) {
    const bar = sortedSeries[idx]!;
    equityCurve.push(computeCurvePointAtBar(bar, walletDec, activeNormalized, trancheStopInfo));
  }
  if (
    equityCurve.length === 0 ||
    equityCurve[equityCurve.length - 1]!.trading_date !== evalPoint.trading_date
  ) {
    equityCurve.push(
      computeCurvePointAtBar(evalPoint, walletDec, activeNormalized, trancheStopInfo)
    );
  }

  // Build Output-Guarded non-advisory historical observations
  const activeCount = evaluatedTranches.filter((t) => t.status !== "AFTER_EVAL_DATE").length;
  const obs1Text =
    activeCount === 0
      ? `No pretend allocations occurred on or before the selected evaluation date (${evalDate}), leaving 100% of the ₹${Number(walletDec.toFixed(0)).toLocaleString("en-IN")} pretend wallet in cash.`
      : `Across ${activeCount} historical allocation(s) totaling ₹${Number(totalAllocatedDec.toFixed(0)).toLocaleString("en-IN")} evaluated through ${evalDate}, the pretend wallet changed by ${totalReturnPctDec.gte(0) ? "+" : ""}${totalReturnPctDec.toFixed(2)}% to ₹${Number(totalPortfolioValueDec.toFixed(0)).toLocaleString("en-IN")}.`;

  const obs2Text =
    params.stop_loss_pct !== null
      ? stoppedOutCount > 0
        ? `A ${params.stop_loss_pct}% historical stop-loss rule was triggered on ${stoppedOutCount} of ${activeCount} allocation(s), converting ₹${Number(stoppedOutCashDec.toFixed(0)).toLocaleString("en-IN")} into cash after the threshold decline.`
        : `A ${params.stop_loss_pct}% historical stop-loss rule was active; maximum observed post-entry drawdown reached ${worstDrawdownPct.toFixed(2)}% without breaching the stop-loss level.`
      : activeCount > 0
        ? `With no stop-loss limit applied, the steepest post-entry historical drawdown experienced by an allocation was ${worstDrawdownPct.toFixed(2)}%${worstDrawdownDate ? ` on ${worstDrawdownDate}` : ""}.`
        : `Select one or more dates on the 10-year historical timeline to observe post-entry drawdown and stop-loss behavior.`;

  const diffVsNiftyDec = totalReturnPctDec.minus(niftyEquivalentReturnPctDec);
  const obs3Text =
    activeCount === 0
      ? `Placing pretend allocations on the 10-year timeline compares individual equity volatility against passive NIFTY 50 index movement over identical dates.`
      : `Allocating the exact same amounts on the exact same historical dates into the NIFTY 50 index benchmark produced ₹${Number(niftyEquivalentPortfolioDec.toFixed(0)).toLocaleString("en-IN")} (${niftyEquivalentReturnPctDec.gte(0) ? "+" : ""}${niftyEquivalentReturnPctDec.toFixed(2)}%), a ${diffVsNiftyDec.gte(0) ? "+" : ""}${diffVsNiftyDec.toFixed(2)} percentage-point difference versus ${params.ticker}.`;

  const observations: GuardedPretendObservation[] = [
    sanitizeObservation("historical_outcome_v1", "Historical Timeline Outcome", obs1Text),
    sanitizeObservation("drawdown_and_risk_v1", "Drawdown & Stop-Loss Evidence", obs2Text),
    sanitizeObservation("benchmark_comparison_v1", "NIFTY 50 Same-Date Baseline", obs3Text),
  ];

  const allPassed = observations.every((o) => o.guard_passed);

  return {
    ticker: params.ticker,
    company_name: params.company_name,
    starting_wallet_inr: Number(walletDec.toFixed(2)),
    evaluation_date: evalDate,
    stop_loss_pct: params.stop_loss_pct,
    total_allocated_inr: Number(totalAllocatedDec.toFixed(2)),
    unallocated_cash_inr: Number(unallocatedCashDec.toFixed(2)),
    stopped_out_cash_inr: Number(stoppedOutCashDec.toFixed(2)),
    active_equity_value_inr: Number(activeEquityValueDec.toFixed(2)),
    total_portfolio_value_inr: Number(totalPortfolioValueDec.toFixed(2)),
    total_net_change_inr: Number(totalNetChangeDec.toFixed(2)),
    total_return_pct: Number(totalReturnPctDec.toFixed(2)),
    portfolio_cagr_pct: portfolioCagrPct,
    worst_tranche_drawdown_pct: worstDrawdownPct,
    worst_drawdown_date: worstDrawdownDate,
    stopped_out_tranche_count: stoppedOutCount,
    nifty_equivalent_portfolio_inr: Number(niftyEquivalentPortfolioDec.toFixed(2)),
    nifty_equivalent_return_pct: Number(niftyEquivalentReturnPctDec.toFixed(2)),
    fixed_reference_portfolio_inr: Number(fixedReferencePortfolioDec.toFixed(2)),
    tranches: evaluatedTranches,
    equity_curve: equityCurve,
    guard_status: allPassed ? "PASSED" : "BLOCKED_FALLBACK",
    observations,
    mandatory_disclaimer: MANDATORY_DISCLAIMER,
  };
}

function computeCurvePointAtBar(
  bar: TenYearTimelinePoint,
  walletDec: Decimal,
  activeNormalized: Array<{
    input: PretendTrancheInput;
    entryPoint: TenYearTimelinePoint;
    entryIndex: number;
    allocatedDec: Decimal;
  }>,
  trancheStopInfo: Map<string, { stoppedDate: string; lockedCashDec: Decimal }>
): PretendPortfolioCurvePoint {
  let deployedSoFarDec = new Decimal(0);
  let stockHoldingsDec = new Decimal(0);
  let benchHoldingsDec = new Decimal(0);

  for (const item of activeNormalized) {
    if (item.entryPoint.trading_date > bar.trading_date) continue;
    deployedSoFarDec = deployedSoFarDec.plus(item.allocatedDec);

    const stopMeta = trancheStopInfo.get(item.input.id);
    if (stopMeta && bar.trading_date >= stopMeta.stoppedDate) {
      stockHoldingsDec = stockHoldingsDec.plus(stopMeta.lockedCashDec);
    } else {
      const unitsDec = item.allocatedDec.div(new Decimal(item.entryPoint.close));
      stockHoldingsDec = stockHoldingsDec.plus(unitsDec.mul(new Decimal(bar.close)));
    }

    const benchUnitsDec = item.allocatedDec.div(new Decimal(item.entryPoint.benchmark_close));
    benchHoldingsDec = benchHoldingsDec.plus(benchUnitsDec.mul(new Decimal(bar.benchmark_close)));
  }

  const unallocatedAtBarDec = walletDec.minus(deployedSoFarDec);
  return {
    trading_date: bar.trading_date,
    stock_close: bar.close,
    deployed_capital_inr: Number(deployedSoFarDec.toFixed(2)),
    portfolio_value_inr: Number(unallocatedAtBarDec.plus(stockHoldingsDec).toFixed(2)),
    nifty_equivalent_inr: Number(unallocatedAtBarDec.plus(benchHoldingsDec).toFixed(2)),
  };
}
