import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AppEnv } from "../../core/env.js";
import { AppError } from "../../core/errors.js";
import type { EvidenceRepository } from "../../db/repository.js";
import {
  DEFAULT_INDIAN_WATCHLIST,
  fetchLiveBenchmarkSummaries,
  fetchLiveStockDetail,
  fetchLiveStockQuote,
  normalizeIndianYahooSymbol,
  searchLiveIndianStocks,
  type LiveStockQuote,
} from "../../integrations/liveMarketFeed.js";

const RangeSchema = z.enum(["1d", "1mo", "3mo", "6mo"]).default("1mo");

function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

async function buildSnapshotFallbackQuote(
  ticker: string,
  repo: EvidenceRepository
): Promise<LiveStockQuote | null> {
  const stock = await repo.getStockByTicker(ticker);
  if (!stock || stock.instrument_type !== "EQUITY") return null;
  const [bars, info] = await Promise.all([
    repo.getPriceHistory(stock.ticker),
    repo.getStockInfo(stock.ticker),
  ]);
  const latest = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  if (!latest) return null;

  const price = Number(latest.close);
  const previousClose = prev ? Number(prev.close) : null;
  const change = previousClose !== null ? Number((price - previousClose).toFixed(2)) : null;
  const changePercent =
    previousClose && change !== null ? Number(((change / previousClose) * 100).toFixed(2)) : null;
  const closes = bars.map((b) => Number(b.close));

  return {
    ticker: stock.ticker,
    yahoo_symbol: `${stock.ticker}.${stock.exchange === "BSE" ? "BO" : "NS"}`,
    company_name: stock.company_name,
    exchange: stock.exchange,
    sector: null,
    currency: "INR",
    price,
    previous_close: previousClose,
    change,
    change_percent: changePercent,
    day_high: null,
    day_low: null,
    fifty_two_week_high: closes.length > 0 ? Math.max(...closes) : null,
    fifty_two_week_low: closes.length > 0 ? Math.min(...closes) : null,
    volume: latest.volume,
    market_cap_cr: info?.market_cap !== null && info?.market_cap !== undefined ? Number(info.market_cap) : null,
    size_band: info?.size_band ?? null,
    as_of_date: latest.trading_date,
    fetched_at: new Date().toISOString(),
    data_freshness: "DATED_SNAPSHOT",
    data_label: latest.data_label === "REAL" ? "REAL" : "SYNTHETIC",
    source_name: latest.source_name,
    delay_note: "Live Yahoo Finance feed unavailable; displaying dated local snapshot fallback.",
    sparkline: bars.slice(-15).map((b) => ({ date: b.trading_date, close: Number(b.close) })),
  };
}

export function createLiveStocksRouter(params: {
  config: AppEnv;
  repo: EvidenceRepository;
  fetchImpl?: typeof fetch;
}): Router {
  const { config, repo, fetchImpl } = params;
  const router = Router();

  // 1. GET /api/live/stocks/quotes?tickers=WIPRO,RELIANCE,...
  router.get(
    "/live/stocks/quotes",
    asyncRoute(async (req, res) => {
      const rawTickers = typeof req.query.tickers === "string" ? req.query.tickers : "";
      const requestedTickers = rawTickers
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length >= 2 && t.length <= 24)
        .slice(0, 15);

      const targetTickers =
        requestedTickers.length > 0
          ? requestedTickers
          : DEFAULT_INDIAN_WATCHLIST.map((w) => w.ticker);

      const [liveBenchmarks, quoteResults] = await Promise.all([
        fetchLiveBenchmarkSummaries({
          enabled: config.LIVE_MARKET_ENABLED,
          cacheTtlMs: config.LIVE_MARKET_CACHE_TTL_MS,
          fetchImpl,
        }),
        Promise.all(
          targetTickers.map(async (ticker) => {
            const watchlistItem = DEFAULT_INDIAN_WATCHLIST.find((w) => w.ticker === ticker);
            const live = await fetchLiveStockQuote(ticker, {
              enabled: config.LIVE_MARKET_ENABLED,
              cacheTtlMs: config.LIVE_MARKET_CACHE_TTL_MS,
              fetchImpl,
              sectorHint: watchlistItem?.sector ?? null,
              companyNameHint: watchlistItem?.company_name,
            });
            if (live) return live;
            return buildSnapshotFallbackQuote(ticker, repo);
          })
        ),
      ]);

      // Fallback benchmarks to local dated snapshots when live fetch is unavailable
      let benchmarks = liveBenchmarks;
      if (!benchmarks) {
        const snapshotBenchmarks = await repo.listBenchmarks();
        const summarize = (key: "NIFTY_50" | "SENSEX" | "BANKNIFTY", label: string) => {
          const series = snapshotBenchmarks[key];
          const latest = series[series.length - 1];
          const prev = series[series.length - 2];
          if (!latest || !prev) {
            return {
              key,
              label,
              status: "COULD_NOT_VERIFY" as const,
              close: null,
              change: null,
              change_percent: null,
              as_of_date: null,
              fetched_at: null,
              data_freshness: null,
              data_label: null,
              source_name: null,
              sparkline: [],
            };
          }
          const change = Number((latest.close - prev.close).toFixed(2));
          const changePercent = Number(((change / prev.close) * 100).toFixed(2));
          return {
            key,
            label,
            status: "AVAILABLE" as const,
            close: latest.close,
            change,
            change_percent: changePercent,
            as_of_date: latest.trading_date,
            fetched_at: null,
            data_freshness: "DATED_SNAPSHOT" as const,
            data_label: latest.data_label,
            source_name: latest.source_name,
            sparkline: series.slice(-15).map((b) => ({ date: b.trading_date, close: b.close })),
          };
        };
        benchmarks = [
          summarize("NIFTY_50", "NIFTY 50"),
          summarize("SENSEX", "SENSEX"),
          summarize("BANKNIFTY", "BANKNIFTY"),
        ];
      }

      const quotes = quoteResults.filter((q): q is LiveStockQuote => q !== null);
      const anyLive = quotes.some((q) => q.data_freshness === "LIVE_FEED");

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        fetched_at: new Date().toISOString(),
        feed_status: anyLive ? "LIVE_FEED" : quotes.length > 0 ? "SNAPSHOT_FALLBACK" : "COULD_NOT_VERIFY",
        benchmarks,
        quotes,
      });
    })
  );

  // 2. GET /api/live/stocks/search?q=
  router.get(
    "/live/stocks/search",
    asyncRoute(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (q.length < 1) {
        res.status(200).json({
          request_id: req.requestId ?? "req_unknown",
          items: DEFAULT_INDIAN_WATCHLIST.map((w) => ({
            ticker: w.ticker,
            yahoo_symbol: w.yahooSymbol,
            company_name: w.company_name,
            exchange: w.exchange,
            instrument_type: "EQUITY" as const,
            sector: w.sector,
            source: "WATCHLIST" as const,
          })),
        });
        return;
      }

      const [liveMatches, localMatches] = await Promise.all([
        searchLiveIndianStocks(q, { enabled: config.LIVE_MARKET_ENABLED, fetchImpl }),
        repo.searchStocks(q),
      ]);

      const merged = new Map<
        string,
        {
          ticker: string;
          yahoo_symbol: string;
          company_name: string;
          exchange: "NSE" | "BSE";
          instrument_type: "EQUITY" | "DERIVATIVE";
          sector: string | null;
          source: "LIVE_SEARCH" | "CATALOGUE";
        }
      >();

      for (const item of liveMatches) {
        merged.set(item.ticker, item);
      }
      for (const item of localMatches) {
        if (!merged.has(item.ticker)) {
          merged.set(item.ticker, {
            ticker: item.ticker,
            yahoo_symbol: `${item.ticker}.${item.exchange === "BSE" ? "BO" : "NS"}`,
            company_name: item.company_name,
            exchange: item.exchange,
            instrument_type: item.instrument_type,
            sector: null,
            source: "CATALOGUE",
          });
        }
      }

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        items: [...merged.values()].slice(0, 12),
      });
    })
  );

  // 3. GET /api/live/stocks/:ticker/detail?range=1d|1mo|3mo|6mo
  router.get(
    "/live/stocks/:ticker/detail",
    asyncRoute(async (req, res) => {
      const rawTicker = String(req.params.ticker ?? "").trim();
      if (!rawTicker || rawTicker.length > 32) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Please specify a valid NSE or BSE stock ticker.",
          statusCode: 400,
          retryable: false,
        });
      }
      const range = RangeSchema.parse(
        typeof req.query.range === "string" ? req.query.range : "1mo"
      );

      const liveDetail = await fetchLiveStockDetail(rawTicker, range, {
        enabled: config.LIVE_MARKET_ENABLED,
        cacheTtlMs: config.LIVE_MARKET_CACHE_TTL_MS,
        fetchImpl,
      });

      if (liveDetail) {
        res.status(200).json({
          request_id: req.requestId ?? "req_unknown",
          ...liveDetail,
        });
        return;
      }

      // Graceful fallback to local dated snapshot when live feed fails
      const { canonicalTicker } = normalizeIndianYahooSymbol(rawTicker);
      const fallbackQuote = await buildSnapshotFallbackQuote(canonicalTicker, repo);
      if (!fallbackQuote) {
        throw new AppError({
          code: "DATA_NOT_AVAILABLE",
          message:
            "Could not verify live market data for this ticker, and no dated snapshot fallback exists.",
          statusCode: 404,
          retryable: true,
        });
      }

      const bars = await repo.getPriceHistory(fallbackQuote.ticker);
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        quote: fallbackQuote,
        range,
        series: bars.map((b) => ({
          label: b.trading_date,
          trading_date: b.trading_date,
          close: Number(b.close),
          volume: b.volume,
        })),
        avg_daily_traded_value_cr: null,
      });
    })
  );

  return router;
}
