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
  range: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y",
  interval: "5m" | "15m" | "1d",
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
