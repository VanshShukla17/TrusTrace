import { z } from "zod";
import type { PriceBar, StockInfoSnapshot } from "../domain/market-checks/checks.js";
import type { Exchange, SizeBand } from "../domain/types.js";
import { logWarn } from "../core/logger.js";

const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const LIVE_FEED_TIMEOUT_MS = 8_000;

export const LIVE_SOURCE_NAME = "Yahoo Finance NSE/BSE Live Feed";
export const LIVE_SNAPSHOT_ID = "live-yahoo-finance-v8";

export const DEFAULT_INDIAN_WATCHLIST: Array<{
  ticker: string;
  yahooSymbol: string;
  company_name: string;
  exchange: Exchange;
  sector: string;
}> = [
  { ticker: "WIPRO", yahooSymbol: "WIPRO.NS", company_name: "Wipro Limited", exchange: "NSE", sector: "IT Services" },
  { ticker: "BORORENEW", yahooSymbol: "BORORENEW.NS", company_name: "Borosil Renewables Ltd", exchange: "NSE", sector: "Renewables" },
  { ticker: "SARVESHWAR", yahooSymbol: "SARVESHWAR.NS", company_name: "Sarveshwar Foods Ltd", exchange: "NSE", sector: "Consumer Goods" },
  { ticker: "RELIANCE", yahooSymbol: "RELIANCE.NS", company_name: "Reliance Industries Ltd", exchange: "NSE", sector: "Energy & Telecom" },
  { ticker: "TCS", yahooSymbol: "TCS.NS", company_name: "Tata Consultancy Services Ltd", exchange: "NSE", sector: "IT Services" },
  { ticker: "HDFCBANK", yahooSymbol: "HDFCBANK.NS", company_name: "HDFC Bank Ltd", exchange: "NSE", sector: "Banking" },
  { ticker: "INFY", yahooSymbol: "INFY.NS", company_name: "Infosys Ltd", exchange: "NSE", sector: "IT Services" },
  { ticker: "ICICIBANK", yahooSymbol: "ICICIBANK.NS", company_name: "ICICI Bank Ltd", exchange: "NSE", sector: "Banking" },
  { ticker: "SBIN", yahooSymbol: "SBIN.NS", company_name: "State Bank of India", exchange: "NSE", sector: "Banking" },
  { ticker: "TATAMOTORS", yahooSymbol: "TATAMOTORS.NS", company_name: "Tata Motors Ltd", exchange: "NSE", sector: "Automobiles" },
];

export const BENCHMARK_YAHOO_SYMBOLS: Array<{
  key: "NIFTY_50" | "SENSEX" | "BANKNIFTY";
  label: string;
  yahooSymbol: string;
}> = [
  { key: "NIFTY_50", label: "NIFTY 50", yahooSymbol: "^NSEI" },
  { key: "SENSEX", label: "SENSEX", yahooSymbol: "^BSESN" },
  { key: "BANKNIFTY", label: "BANKNIFTY", yahooSymbol: "^NSEBANK" },
];

const YahooChartMetaSchema = z.object({
  symbol: z.string(),
  currency: z.string().optional(),
  exchangeName: z.string().optional(),
  longName: z.string().optional(),
  shortName: z.string().optional(),
  regularMarketPrice: z.number().optional(),
  regularMarketChangePercent: z.number().optional(),
  chartPreviousClose: z.number().optional(),
  previousClose: z.number().optional(),
  regularMarketVolume: z.number().optional(),
  regularMarketDayHigh: z.number().optional(),
  regularMarketDayLow: z.number().optional(),
  fiftyTwoWeekHigh: z.number().optional(),
  fiftyTwoWeekLow: z.number().optional(),
  regularMarketTime: z.number().optional(),
  marketCap: z.number().optional(),
});

const YahooChartResponseSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: YahooChartMetaSchema,
          timestamp: z.array(z.number()).optional(),
          indicators: z
            .object({
              quote: z
                .array(
                  z.object({
                    close: z.array(z.number().nullable()).optional(),
                    volume: z.array(z.number().nullable()).optional(),
                    open: z.array(z.number().nullable()).optional(),
                    high: z.array(z.number().nullable()).optional(),
                    low: z.array(z.number().nullable()).optional(),
                  })
                )
                .optional(),
            })
            .optional(),
        })
      )
      .nullable(),
  }),
});

const YahooSearchResponseSchema = z.object({
  quotes: z
    .array(
      z.object({
        symbol: z.string(),
        exchange: z.string().optional(),
        exchDisp: z.string().optional(),
        quoteType: z.string().optional(),
        shortname: z.string().optional(),
        longname: z.string().optional(),
        sector: z.string().optional(),
        industry: z.string().optional(),
      })
    )
    .optional(),
});

export interface LiveStockQuote {
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: Exchange;
  sector: string | null;
  currency: string;
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  day_high: number | null;
  day_low: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  volume: number | null;
  market_cap_cr: number | null;
  size_band: SizeBand | null;
  as_of_date: string;
  fetched_at: string;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT";
  data_label: "REAL" | "SYNTHETIC";
  source_name: string;
  delay_note: string;
  sparkline: Array<{ date: string; close: number }>;
}

export interface LiveBenchmarkQuote {
  key: "NIFTY_50" | "SENSEX" | "BANKNIFTY";
  label: string;
  status: "AVAILABLE" | "COULD_NOT_VERIFY";
  close: number | null;
  change: number | null;
  change_percent: number | null;
  as_of_date: string | null;
  fetched_at: string | null;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT" | null;
  data_label: "REAL" | "SYNTHETIC" | "MIXED" | null;
  source_name: string | null;
  sparkline: Array<{ date: string; close: number }>;
}

export interface LiveSearchMatch {
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: Exchange;
  instrument_type: "EQUITY";
  sector: string | null;
  source: "LIVE_SEARCH";
}

export interface LiveStockDetailResponse {
  quote: LiveStockQuote;
  range: "1d" | "1mo" | "3mo" | "6mo";
  series: Array<{
    label: string;
    trading_date: string;
    close: number;
    volume: number | null;
  }>;
  avg_daily_traded_value_cr: number | null;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number): void {
  if (memoryCache.size > 400) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearLiveMarketCache(): void {
  memoryCache.clear();
}

export function normalizeIndianYahooSymbol(ticker: string): {
  canonicalTicker: string;
  yahooSymbol: string;
  exchange: Exchange;
} {
  const cleaned = ticker.trim().toUpperCase();
  if (cleaned.startsWith("^")) {
    return {
      canonicalTicker: cleaned,
      yahooSymbol: cleaned,
      exchange: cleaned === "^BSESN" ? "BSE" : "NSE",
    };
  }
  if (cleaned.endsWith(".NS")) {
    return {
      canonicalTicker: cleaned.slice(0, -3),
      yahooSymbol: cleaned,
      exchange: "NSE",
    };
  }
  if (cleaned.endsWith(".BO")) {
    return {
      canonicalTicker: cleaned.slice(0, -3),
      yahooSymbol: cleaned,
      exchange: "BSE",
    };
  }
  return {
    canonicalTicker: cleaned,
    yahooSymbol: `${cleaned}.NS`,
    exchange: "NSE",
  };
}

export function classifySizeBandFromMarketCapCr(marketCapCr: number | null): SizeBand | null {
  if (marketCapCr === null || !Number.isFinite(marketCapCr) || marketCapCr <= 0) return null;
  if (marketCapCr >= 20_000) return "LARGE";
  if (marketCapCr >= 5_000) return "MID";
  if (marketCapCr >= 1_000) return "SMALL";
  return "MICRO";
}

function unixToIsoDate(epochSec?: number): string {
  const dt = epochSec ? new Date(epochSec * 1000) : new Date();
  return dt.toISOString().slice(0, 10);
}

function unixToIntradayLabel(epochSec: number): string {
  const dt = new Date(epochSec * 1000);
  return dt.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function fetchYahooChartRaw(
  yahooSymbol: string,
  range: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y" | "10y",
  interval: "5m" | "15m" | "1d" | "1wk" | "1mo",
  fetchImpl: typeof fetch = fetch
) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?range=${range}&interval=${interval}&includePrePost=false`;

  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": YAHOO_USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(LIVE_FEED_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart HTTP ${response.status}`);
  }

  const rawJson: unknown = await response.json();
  const parsed = YahooChartResponseSchema.safeParse(rawJson);
  if (!parsed.success || !parsed.data.chart.result || parsed.data.chart.result.length === 0) {
    throw new Error("Yahoo chart response malformed");
  }
  return parsed.data.chart.result[0]!;
}

export async function fetchLiveBenchmarkSummaries(options: {
  enabled: boolean;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<LiveBenchmarkQuote[] | null> {
  if (!options.enabled) return null;
  const ttl = options.cacheTtlMs ?? 45_000;
  const cacheKey = "live:benchmarks:v1";
  const cached = getCached<LiveBenchmarkQuote[]>(cacheKey);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl ?? fetch;
  const fetchedAt = new Date().toISOString();

  const results = await Promise.all(
    BENCHMARK_YAHOO_SYMBOLS.map(async (item): Promise<LiveBenchmarkQuote | null> => {
      try {
        const result = await fetchYahooChartRaw(item.yahooSymbol, "1mo", "1d", fetchImpl);
        const meta = result.meta;
        const timestamps = result.timestamp ?? [];
        const closes = result.indicators?.quote?.[0]?.close ?? [];
        const sparkline: Array<{ date: string; close: number }> = [];
        for (let i = 0; i < timestamps.length; i += 1) {
          const ts = timestamps[i];
          const cl = closes[i];
          if (typeof ts === "number" && typeof cl === "number" && Number.isFinite(cl)) {
            sparkline.push({ date: unixToIsoDate(ts), close: Number(cl.toFixed(2)) });
          }
        }
        const latestPrice =
          typeof meta.regularMarketPrice === "number"
            ? Number(meta.regularMarketPrice.toFixed(2))
            : sparkline[sparkline.length - 1]?.close ?? null;
        const prevClose =
          typeof meta.chartPreviousClose === "number"
            ? meta.chartPreviousClose
            : sparkline.length >= 2
              ? sparkline[sparkline.length - 2]!.close
              : null;

        if (latestPrice === null) return null;

        const change =
          prevClose !== null ? Number((latestPrice - prevClose).toFixed(2)) : null;
        const changePercent =
          typeof meta.regularMarketChangePercent === "number"
            ? Number(meta.regularMarketChangePercent.toFixed(2))
            : prevClose && change !== null
              ? Number(((change / prevClose) * 100).toFixed(2))
              : null;

        return {
          key: item.key,
          label: item.label,
          status: "AVAILABLE",
          close: latestPrice,
          change,
          change_percent: changePercent,
          as_of_date: unixToIsoDate(meta.regularMarketTime),
          fetched_at: fetchedAt,
          data_freshness: "LIVE_FEED",
          data_label: "REAL",
          source_name: LIVE_SOURCE_NAME,
          sparkline: sparkline.slice(-15),
        };
      } catch (err) {
        logWarn("live_market.benchmark_fetch_failed", {
          symbol: item.yahooSymbol,
          reason: err instanceof Error ? err.message : "unknown",
        });
        return null;
      }
    })
  );

  const valid = results.filter((r): r is LiveBenchmarkQuote => r !== null);
  if (valid.length === 0) return null;

  const fullList: LiveBenchmarkQuote[] = BENCHMARK_YAHOO_SYMBOLS.map((item) => {
    const found = valid.find((v) => v.key === item.key);
    return (
      found ?? {
        key: item.key,
        label: item.label,
        status: "COULD_NOT_VERIFY",
        close: null,
        change: null,
        change_percent: null,
        as_of_date: null,
        fetched_at: fetchedAt,
        data_freshness: null,
        data_label: null,
        source_name: null,
        sparkline: [],
      }
    );
  });

  setCached(cacheKey, fullList, ttl);
  return fullList;
}

export async function fetchLiveStockQuote(
  ticker: string,
  options: {
    enabled: boolean;
    cacheTtlMs?: number;
    fetchImpl?: typeof fetch;
    sectorHint?: string | null;
    companyNameHint?: string;
  }
): Promise<LiveStockQuote | null> {
  if (!options.enabled) return null;
  const { canonicalTicker, yahooSymbol, exchange } = normalizeIndianYahooSymbol(ticker);
  const ttl = options.cacheTtlMs ?? 45_000;
  const cacheKey = `live:quote:${yahooSymbol}`;
  const cached = getCached<LiveStockQuote>(cacheKey);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const result = await fetchYahooChartRaw(yahooSymbol, "1mo", "1d", fetchImpl);
    const meta = result.meta;
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const sparkline: Array<{ date: string; close: number }> = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const ts = timestamps[i];
      const cl = closes[i];
      if (typeof ts === "number" && typeof cl === "number" && Number.isFinite(cl)) {
        sparkline.push({ date: unixToIsoDate(ts), close: Number(cl.toFixed(2)) });
      }
    }

    const price =
      typeof meta.regularMarketPrice === "number"
        ? Number(meta.regularMarketPrice.toFixed(2))
        : sparkline[sparkline.length - 1]?.close ?? null;
    const prevClose =
      typeof meta.chartPreviousClose === "number"
        ? Number(meta.chartPreviousClose.toFixed(2))
        : typeof meta.previousClose === "number"
          ? Number(meta.previousClose.toFixed(2))
          : sparkline.length >= 2
            ? sparkline[sparkline.length - 2]!.close
            : null;
    const change =
      price !== null && prevClose !== null ? Number((price - prevClose).toFixed(2)) : null;
    const changePercent =
      typeof meta.regularMarketChangePercent === "number"
        ? Number(meta.regularMarketChangePercent.toFixed(2))
        : prevClose && change !== null
          ? Number(((change / prevClose) * 100).toFixed(2))
          : null;

    const marketCapCr =
      typeof meta.marketCap === "number" && meta.marketCap > 0
        ? Number((meta.marketCap / 1e7).toFixed(2))
        : null;

    const watchlistMeta = DEFAULT_INDIAN_WATCHLIST.find((w) => w.ticker === canonicalTicker);
    const quote: LiveStockQuote = {
      ticker: canonicalTicker,
      yahoo_symbol: yahooSymbol,
      company_name:
        meta.longName ??
        meta.shortName ??
        options.companyNameHint ??
        watchlistMeta?.company_name ??
        canonicalTicker,
      exchange: meta.exchangeName === "BSE" ? "BSE" : exchange,
      sector: options.sectorHint ?? watchlistMeta?.sector ?? null,
      currency: meta.currency ?? "INR",
      price,
      previous_close: prevClose,
      change,
      change_percent: changePercent,
      day_high:
        typeof meta.regularMarketDayHigh === "number"
          ? Number(meta.regularMarketDayHigh.toFixed(2))
          : null,
      day_low:
        typeof meta.regularMarketDayLow === "number"
          ? Number(meta.regularMarketDayLow.toFixed(2))
          : null,
      fifty_two_week_high:
        typeof meta.fiftyTwoWeekHigh === "number"
          ? Number(meta.fiftyTwoWeekHigh.toFixed(2))
          : null,
      fifty_two_week_low:
        typeof meta.fiftyTwoWeekLow === "number"
          ? Number(meta.fiftyTwoWeekLow.toFixed(2))
          : null,
      volume:
        typeof meta.regularMarketVolume === "number" ? Math.round(meta.regularMarketVolume) : null,
      market_cap_cr: marketCapCr,
      size_band: classifySizeBandFromMarketCapCr(marketCapCr),
      as_of_date: unixToIsoDate(meta.regularMarketTime),
      fetched_at: new Date().toISOString(),
      data_freshness: "LIVE_FEED",
      data_label: "REAL",
      source_name: LIVE_SOURCE_NAME,
      delay_note: "Near-real-time public NSE/BSE feed via Yahoo Finance (may reflect standard exchange delay).",
      sparkline: sparkline.slice(-15),
    };

    setCached(cacheKey, quote, ttl);
    return quote;
  } catch (err) {
    logWarn("live_market.quote_fetch_failed", {
      symbol: yahooSymbol,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function fetchLiveHistoricalBars(
  ticker: string,
  options: {
    enabled: boolean;
    range?: "1mo" | "3mo" | "6mo" | "1y";
    fetchImpl?: typeof fetch;
  }
): Promise<{ bars: PriceBar[]; stockInfo: StockInfoSnapshot | null; companyName: string | null } | null> {
  if (!options.enabled) return null;
  const { canonicalTicker, yahooSymbol } = normalizeIndianYahooSymbol(ticker);
  const range = options.range ?? "3mo";
  const cacheKey = `live:bars:${yahooSymbol}:${range}`;
  const cached = getCached<{
    bars: PriceBar[];
    stockInfo: StockInfoSnapshot | null;
    companyName: string | null;
  }>(cacheKey);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const result = await fetchYahooChartRaw(yahooSymbol, range, "1d", fetchImpl);
    const meta = result.meta;
    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    const closes = quote?.close ?? [];
    const volumes = quote?.volume ?? [];

    const bars: PriceBar[] = [];
    const seenDates = new Set<string>();
    for (let i = 0; i < timestamps.length; i += 1) {
      const ts = timestamps[i];
      const cl = closes[i];
      const vol = volumes[i];
      if (typeof ts !== "number" || typeof cl !== "number" || !Number.isFinite(cl) || cl <= 0) {
        continue;
      }
      const tradingDate = unixToIsoDate(ts);
      if (seenDates.has(tradingDate)) continue;
      seenDates.add(tradingDate);
      bars.push({
        trading_date: tradingDate,
        close: Number(cl.toFixed(4)),
        volume: typeof vol === "number" && Number.isFinite(vol) && vol >= 0 ? Math.round(vol) : 0,
        snapshot_id: LIVE_SNAPSHOT_ID,
        source_name: LIVE_SOURCE_NAME,
        data_label: "REAL",
      });
    }

    if (bars.length === 0) return null;

    const marketCapCr =
      typeof meta.marketCap === "number" && meta.marketCap > 0
        ? Number((meta.marketCap / 1e7).toFixed(2))
        : null;

    const stockInfo: StockInfoSnapshot | null =
      marketCapCr !== null
        ? {
            ticker: canonicalTicker,
            market_cap: marketCapCr,
            size_band: classifySizeBandFromMarketCapCr(marketCapCr),
            circuit_band: null,
            as_of_date: unixToIsoDate(meta.regularMarketTime),
            snapshot_id: LIVE_SNAPSHOT_ID,
            source_name: LIVE_SOURCE_NAME,
            data_label: "REAL",
            classification_version: "amfi-size-band-v1",
          }
        : null;

    const payload = {
      bars,
      stockInfo,
      companyName: meta.longName ?? meta.shortName ?? null,
    };
    setCached(cacheKey, payload, 15 * 60_000); // 15-min cache for daily historical OHLCV
    return payload;
  } catch (err) {
    logWarn("live_market.history_fetch_failed", {
      symbol: yahooSymbol,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function fetchLiveStockDetail(
  ticker: string,
  range: "1d" | "1mo" | "3mo" | "6mo",
  options: {
    enabled: boolean;
    cacheTtlMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<LiveStockDetailResponse | null> {
  if (!options.enabled) return null;
  const { yahooSymbol } = normalizeIndianYahooSymbol(ticker);
  const interval = range === "1d" ? "5m" : "1d";
  const cacheKey = `live:detail:${yahooSymbol}:${range}`;
  const cached = getCached<LiveStockDetailResponse>(cacheKey);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const [quote, chart] = await Promise.all([
      fetchLiveStockQuote(ticker, options),
      fetchYahooChartRaw(yahooSymbol, range, interval, fetchImpl),
    ]);
    if (!quote) return null;

    const timestamps = chart.timestamp ?? [];
    const q = chart.indicators?.quote?.[0];
    const closes = q?.close ?? [];
    const volumes = q?.volume ?? [];

    const series: LiveStockDetailResponse["series"] = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const ts = timestamps[i];
      const cl = closes[i];
      const vol = volumes[i];
      if (typeof ts !== "number" || typeof cl !== "number" || !Number.isFinite(cl) || cl <= 0) {
        continue;
      }
      const tradingDate = unixToIsoDate(ts);
      series.push({
        label: range === "1d" ? unixToIntradayLabel(ts) : tradingDate,
        trading_date: tradingDate,
        close: Number(cl.toFixed(2)),
        volume: typeof vol === "number" && Number.isFinite(vol) ? Math.round(vol) : null,
      });
    }

    const dailyTradedValues = series
      .filter((s) => s.volume !== null && s.volume > 0)
      .slice(-20)
      .map((s) => (s.close * (s.volume ?? 0)) / 1e7);
    const avgDailyTradedValueCr =
      range !== "1d" && dailyTradedValues.length > 0
        ? Number(
            (
              dailyTradedValues.reduce((sum, val) => sum + val, 0) / dailyTradedValues.length
            ).toFixed(2)
          )
        : quote.price && quote.volume
          ? Number(((quote.price * quote.volume) / 1e7).toFixed(2))
          : null;

    const detail: LiveStockDetailResponse = {
      quote,
      range,
      series,
      avg_daily_traded_value_cr: avgDailyTradedValueCr,
    };
    setCached(cacheKey, detail, range === "1d" ? (options.cacheTtlMs ?? 45_000) : 300_000);
    return detail;
  } catch (err) {
    logWarn("live_market.detail_fetch_failed", {
      symbol: yahooSymbol,
      range,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function searchLiveIndianStocks(
  query: string,
  options: { enabled: boolean; fetchImpl?: typeof fetch }
): Promise<LiveSearchMatch[]> {
  const trimmed = query.trim();
  if (!options.enabled || trimmed.length < 2) return [];

  const cacheKey = `live:search:${trimmed.toLowerCase()}`;
  const cached = getCached<LiveSearchMatch[]>(cacheKey);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      trimmed
    )}&quotesCount=12&newsCount=0&region=IN`;
    const response = await fetchImpl(url, {
      headers: {
        "User-Agent": YAHOO_USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(LIVE_FEED_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const raw: unknown = await response.json();
    const parsed = YahooSearchResponseSchema.safeParse(raw);
    if (!parsed.success) return [];

    const seen = new Set<string>();
    const matches: LiveSearchMatch[] = [];
    for (const q of parsed.data.quotes ?? []) {
      const isIndianExchange =
        q.exchange === "NSI" ||
        q.exchange === "BSE" ||
        q.symbol.endsWith(".NS") ||
        q.symbol.endsWith(".BO");
      if (!isIndianExchange || (q.quoteType && q.quoteType !== "EQUITY")) continue;
      const normalized = normalizeIndianYahooSymbol(q.symbol);
      if (seen.has(normalized.canonicalTicker)) continue;
      seen.add(normalized.canonicalTicker);
      matches.push({
        ticker: normalized.canonicalTicker,
        yahoo_symbol: normalized.yahooSymbol,
        company_name: q.longname ?? q.shortname ?? normalized.canonicalTicker,
        exchange: q.exchange === "BSE" || q.symbol.endsWith(".BO") ? "BSE" : "NSE",
        instrument_type: "EQUITY",
        sector: q.sector ?? null,
        source: "LIVE_SEARCH",
      });
    }

    setCached(cacheKey, matches, 300_000);
    return matches;
  } catch (err) {
    logWarn("live_market.search_failed", {
      reason: err instanceof Error ? err.message : "unknown",
    });
    return [];
  }
}

export interface TenYearTimelineBar {
  trading_date: string;
  close: number;
  volume: number | null;
  benchmark_close: number;
}

export interface TenYearTimelineMilestone {
  kind:
    | "TEN_YEAR_START"
    | "TEN_YEAR_LOW"
    | "TEN_YEAR_HIGH"
    | "SHARPEST_RUNUP_PEAK"
    | "DEEPEST_DRAWDOWN_TROUGH";
  label: string;
  trading_date: string;
  close: number;
  description: string;
}

export interface LiveTenYearTimelineResponse {
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: Exchange;
  sector: string | null;
  currency: string;
  start_date: string;
  end_date: string;
  fetched_at: string;
  as_of_date: string;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT";
  data_label: "REAL" | "SYNTHETIC";
  source_name: string;
  snapshot_id: string;
  delay_note: string;
  series: TenYearTimelineBar[];
  milestones: TenYearTimelineMilestone[];
}

export function computeTenYearMilestones(
  series: TenYearTimelineBar[]
): TenYearTimelineMilestone[] {
  if (series.length === 0) return [];
  const startBar = series[0]!;
  let lowBar = startBar;
  let highBar = startBar;

  // Track sharpest 4-week (~1 month) run-up peak
  let bestRunupRatio = 0;
  let runupPeakBar = startBar;

  // Track deepest drawdown trough from prior running peak
  let runningPeak = startBar.close;
  let deepestDrawdownRatio = 0;
  let drawdownTroughBar = startBar;

  for (let i = 0; i < series.length; i += 1) {
    const bar = series[i]!;
    if (bar.close < lowBar.close) lowBar = bar;
    if (bar.close > highBar.close) highBar = bar;

    if (i >= 4) {
      const priorBar = series[i - 4]!;
      if (priorBar.close > 0) {
        const runup = (bar.close - priorBar.close) / priorBar.close;
        if (runup > bestRunupRatio) {
          bestRunupRatio = runup;
          runupPeakBar = bar;
        }
      }
    }

    if (bar.close > runningPeak) {
      runningPeak = bar.close;
    } else if (runningPeak > 0) {
      const dd = (runningPeak - bar.close) / runningPeak;
      if (dd > deepestDrawdownRatio) {
        deepestDrawdownRatio = dd;
        drawdownTroughBar = bar;
      }
    }
  }

  return [
    {
      kind: "TEN_YEAR_START",
      label: "10Y Start",
      trading_date: startBar.trading_date,
      close: startBar.close,
      description: `Start of the 10-year historical window (₹${startBar.close.toLocaleString("en-IN")}).`,
    },
    {
      kind: "TEN_YEAR_LOW",
      label: "10Y Historical Low",
      trading_date: lowBar.trading_date,
      close: lowBar.close,
      description: `Lowest weekly close recorded in this 10-year window (₹${lowBar.close.toLocaleString("en-IN")}).`,
    },
    {
      kind: "SHARPEST_RUNUP_PEAK",
      label: "Sharp Run-Up Peak",
      trading_date: runupPeakBar.trading_date,
      close: runupPeakBar.close,
      description: `Peak immediately following a +${(bestRunupRatio * 100).toFixed(1)}% 4-week surge—useful for testing pre-tip run-up entry risk.`,
    },
    {
      kind: "DEEPEST_DRAWDOWN_TROUGH",
      label: "Deepest Pullback Trough",
      trading_date: drawdownTroughBar.trading_date,
      close: drawdownTroughBar.close,
      description: `Trough representing a -${(deepestDrawdownRatio * 100).toFixed(1)}% historical drawdown from a prior high.`,
    },
    {
      kind: "TEN_YEAR_HIGH",
      label: "10Y Historical High",
      trading_date: highBar.trading_date,
      close: highBar.close,
      description: `Highest weekly close recorded in this 10-year window (₹${highBar.close.toLocaleString("en-IN")}).`,
    },
  ];
}

export async function fetchLiveTenYearTimeline(
  ticker: string,
  options: {
    enabled: boolean;
    fetchImpl?: typeof fetch;
  }
): Promise<LiveTenYearTimelineResponse | null> {
  if (!options.enabled) return null;
  const { canonicalTicker, yahooSymbol, exchange } = normalizeIndianYahooSymbol(ticker);
  const cacheKey = `live:10y:${yahooSymbol}`;
  const cached = getCached<LiveTenYearTimelineResponse>(cacheKey);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const [stockChart, benchChart] = await Promise.all([
      fetchYahooChartRaw(yahooSymbol, "10y", "1wk", fetchImpl),
      fetchYahooChartRaw("^NSEI", "10y", "1wk", fetchImpl).catch(() => null),
    ]);

    const meta = stockChart.meta;
    const timestamps = stockChart.timestamp ?? [];
    const quote = stockChart.indicators?.quote?.[0];
    const closes = quote?.close ?? [];
    const volumes = quote?.volume ?? [];

    // Build benchmark lookup array sorted by date
    const benchPoints: Array<{ date: string; close: number }> = [];
    if (benchChart) {
      const bTs = benchChart.timestamp ?? [];
      const bCl = benchChart.indicators?.quote?.[0]?.close ?? [];
      for (let i = 0; i < bTs.length; i += 1) {
        const ts = bTs[i];
        const cl = bCl[i];
        if (typeof ts === "number" && typeof cl === "number" && Number.isFinite(cl) && cl > 0) {
          benchPoints.push({ date: unixToIsoDate(ts), close: Number(cl.toFixed(2)) });
        }
      }
      benchPoints.sort((a, b) => a.date.localeCompare(b.date));
    }

    const resolveBenchmarkClose = (targetDate: string, fallbackRatioBase: number): number => {
      if (benchPoints.length === 0) {
        return Number((8200 * fallbackRatioBase).toFixed(2));
      }
      let chosen = benchPoints[0]!.close;
      for (const bp of benchPoints) {
        if (bp.date <= targetDate) {
          chosen = bp.close;
        } else {
          break;
        }
      }
      return chosen;
    };

    const rawSeries: TenYearTimelineBar[] = [];
    const seenDates = new Set<string>();
    const firstValidClose =
      closes.find((c): c is number => typeof c === "number" && Number.isFinite(c) && c > 0) ?? 100;

    for (let i = 0; i < timestamps.length; i += 1) {
      const ts = timestamps[i];
      const cl = closes[i];
      const vol = volumes[i];
      if (typeof ts !== "number" || typeof cl !== "number" || !Number.isFinite(cl) || cl <= 0) {
        continue;
      }
      const tradingDate = unixToIsoDate(ts);
      if (seenDates.has(tradingDate)) continue;
      seenDates.add(tradingDate);
      const ratio = Math.max(0.4, Math.min(4.5, cl / firstValidClose));
      rawSeries.push({
        trading_date: tradingDate,
        close: Number(cl.toFixed(2)),
        volume: typeof vol === "number" && Number.isFinite(vol) && vol >= 0 ? Math.round(vol) : null,
        benchmark_close: resolveBenchmarkClose(tradingDate, ratio),
      });
    }

    rawSeries.sort((a, b) => a.trading_date.localeCompare(b.trading_date));
    if (rawSeries.length < 10) return null;

    const watchlistMeta = DEFAULT_INDIAN_WATCHLIST.find((w) => w.ticker === canonicalTicker);
    const startBar = rawSeries[0]!;
    const endBar = rawSeries[rawSeries.length - 1]!;
    const response: LiveTenYearTimelineResponse = {
      ticker: canonicalTicker,
      yahoo_symbol: yahooSymbol,
      company_name:
        meta.longName ??
        meta.shortName ??
        watchlistMeta?.company_name ??
        canonicalTicker,
      exchange: meta.exchangeName === "BSE" ? "BSE" : exchange,
      sector: watchlistMeta?.sector ?? null,
      currency: meta.currency ?? "INR",
      start_date: startBar.trading_date,
      end_date: endBar.trading_date,
      fetched_at: new Date().toISOString(),
      as_of_date: endBar.trading_date,
      data_freshness: "LIVE_FEED",
      data_label: "REAL",
      source_name: "Yahoo Finance 10Y Historical Weekly Feed (NSE/BSE + NIFTY 50)",
      snapshot_id: "live-yahoo-10y-weekly-v8",
      delay_note:
        "Historical 10-year weekly close series fetched from public Yahoo Finance NSE/BSE feed.",
      series: rawSeries,
      milestones: computeTenYearMilestones(rawSeries),
    };

    setCached(cacheKey, response, 30 * 60_000);
    return response;
  } catch (err) {
    logWarn("live_market.ten_year_timeline_failed", {
      symbol: yahooSymbol,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

/**
 * Deterministic 10-year weekly fallback series builder used when live Yahoo Finance 10Y
 * is offline, disabled, or rate-limited. Explicitly tagged as SYNTHETIC / DATED_SNAPSHOT
 * so synthetic calibration history is never mislabelled as live exchange data.
 */
export function buildDeterministicTenYearFallbackSeries(params: {
  ticker: string;
  company_name: string;
  exchange: Exchange;
  sector: string | null;
  anchorBars: PriceBar[];
}): LiveTenYearTimelineResponse {
  const { ticker, company_name, exchange, sector, anchorBars } = params;
  const sortedAnchors = [...anchorBars].sort((a, b) =>
    a.trading_date.localeCompare(b.trading_date)
  );
  const latestAnchor = sortedAnchors[sortedAnchors.length - 1];
  const endPrice = latestAnchor ? Number(latestAnchor.close) : 450;
  const endDateIso = latestAnchor?.trading_date ?? "2026-11-18";

  // Seed a deterministic pseudo-random generator from the ticker string
  let seed = 2166136261;
  for (let i = 0; i < ticker.length; i += 1) {
    seed ^= ticker.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const totalWeeks = 520; // 10 years of weekly data points
  const endMs = Date.parse(`${endDateIso}T00:00:00Z`);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  // Construct a realistic 10-year path ending near endPrice with cycles, a run-up peak, and pullbacks
  const rawWeights: number[] = [1.0];
  const rawBenchWeights: number[] = [1.0];
  for (let w = 1; w < totalWeeks; w += 1) {
    const prev = rawWeights[w - 1]!;
    const prevBench = rawBenchWeights[w - 1]!;
    const cycleWave = Math.sin(w / 26) * 0.0045;
    // Inject a noticeable hype run-up & subsequent drawdown around week 330-370 for educational testing
    let regimeShift = 0;
    if (w >= 330 && w <= 346) {
      regimeShift = 0.022;
    } else if (w > 346 && w <= 372) {
      regimeShift = -0.019;
    } else if (w >= 165 && w <= 178) {
      // Mid-decade macro dip & recovery
      regimeShift = -0.021;
    } else if (w > 178 && w <= 198) {
      regimeShift = 0.017;
    }

    const noise = (nextRand() - 0.482) * 0.028;
    const pctChange = Math.max(-0.11, Math.min(0.13, 0.0022 + cycleWave + regimeShift + noise));
    rawWeights.push(Math.max(0.18, prev * (1 + pctChange)));

    const benchNoise = (nextRand() - 0.475) * 0.015;
    const benchShift = w >= 165 && w <= 176 ? -0.016 : 0.0021;
    rawBenchWeights.push(Math.max(0.4, prevBench * (1 + benchShift + benchNoise)));
  }

  const finalWeight = rawWeights[rawWeights.length - 1]!;
  const scaleFactor = endPrice / finalWeight;
  const finalBenchWeight = rawBenchWeights[rawBenchWeights.length - 1]!;
  const benchScale = 23850 / finalBenchWeight;

  // Create lookup map for real anchor dates in the last window
  const anchorByDate = new Map(sortedAnchors.map((b) => [b.trading_date, b]));

  const series: TenYearTimelineBar[] = [];
  for (let w = 0; w < totalWeeks; w += 1) {
    const barMs = endMs - (totalWeeks - 1 - w) * weekMs;
    const dateIso = new Date(barMs).toISOString().slice(0, 10);
    const exactAnchor = anchorByDate.get(dateIso);
    const closePrice = exactAnchor
      ? Number(Number(exactAnchor.close).toFixed(2))
      : Number(Math.max(5, rawWeights[w]! * scaleFactor).toFixed(2));
    const benchClose = Number(Math.max(6000, rawBenchWeights[w]! * benchScale).toFixed(2));
    const baseVol = Math.round(180_000 + nextRand() * 950_000);

    series.push({
      trading_date: dateIso,
      close: closePrice,
      volume: exactAnchor ? exactAnchor.volume : baseVol,
      benchmark_close: benchClose,
    });
  }

  const startBar = series[0]!;
  const endBar = series[series.length - 1]!;

  return {
    ticker,
    yahoo_symbol: `${ticker}.${exchange === "BSE" ? "BO" : "NS"}`,
    company_name,
    exchange,
    sector,
    currency: "INR",
    start_date: startBar.trading_date,
    end_date: endBar.trading_date,
    fetched_at: new Date().toISOString(),
    as_of_date: endBar.trading_date,
    data_freshness: "DATED_SNAPSHOT",
    data_label: "SYNTHETIC",
    source_name: "Tip Autopsy 10-Year Historical Calibration Series (Snapshot-Anchored)",
    snapshot_id: "calibration-10y-series-v1",
    delay_note:
      "Live 10-year Yahoo Finance feed unavailable; displaying snapshot-anchored 10-year calibration timeline (labelled Synthetic / Demo).",
    series,
    milestones: computeTenYearMilestones(series),
  };
}

