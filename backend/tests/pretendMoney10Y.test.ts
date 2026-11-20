import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/core/env.js";
import { createEvidenceRepository } from "../src/db/repository.js";
import { scanSystemAuthoredText } from "../src/domain/output-guard/guard.js";
import { evaluatePretendMoneyTimeline } from "../src/domain/pretend-money/pretendMoneySimulator.js";

describe("Phase 5 — Pretend Money 10-Year Historical Timeline Sandbox", () => {
  const config = loadEnv({
    NODE_ENV: "test",
    LIVE_MARKET_ENABLED: "false",
    YOUTUBE_MONITOR_ENABLED: "false",
  });
  const repo = createEvidenceRepository(config);
  const app = createApp({ config, repo });

  it("serves a 10-year historical timeline with 520 weekly bars, NIFTY 50 alignment, and milestones", async () => {
    const res = await request(app)
      .get("/api/live/stocks/RELIANCE/timeline-10y")
      .expect(200);

    expect(res.body.ticker).toBe("RELIANCE");
    expect(res.body.series.length).toBeGreaterThanOrEqual(500);
    expect(res.body.milestones.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data_freshness).toBe("DATED_SNAPSHOT");
    expect(res.body.data_label).toBe("SYNTHETIC");

    const first = res.body.series[0];
    const last = res.body.series[res.body.series.length - 1];
    expect(first.trading_date < last.trading_date).toBe(true);
    expect(typeof first.close).toBe("number");
    expect(typeof first.benchmark_close).toBe("number");
  });

  it("evaluates pretend money timeline choices deterministically with decimal.js, stop-loss triggers, and Output Guard verification", async () => {
    const timelineRes = await request(app)
      .get("/api/live/stocks/WIPRO/timeline-10y")
      .expect(200);

    const series = timelineRes.body.series as Array<{
      trading_date: string;
      close: number;
      volume: number | null;
      benchmark_close: number;
    }>;
    const startBar = series[0]!;
    const midBar = series[Math.floor(series.length * 0.5)]!;

    const evalRes = await request(app)
      .post("/api/live/stocks/WIPRO/pretend-evaluate")
      .send({
        starting_wallet_inr: 100_000,
        stop_loss_pct: 15,
        tranches: [
          {
            id: "tranche-1",
            entry_date: startBar.trading_date,
            amount_inr: 60_000,
            label: "10Y Start Choice",
          },
          {
            id: "tranche-2",
            entry_date: midBar.trading_date,
            amount_inr: 40_000,
            label: "Mid-Decade Choice",
          },
        ],
      })
      .expect(200);

    expect(evalRes.body.ticker).toBe("WIPRO");
    expect(evalRes.body.starting_wallet_inr).toBe(100_000);
    expect(evalRes.body.total_allocated_inr).toBe(100_000);
    expect(evalRes.body.unallocated_cash_inr).toBe(0);
    expect(evalRes.body.tranches).toHaveLength(2);
    expect(evalRes.body.equity_curve.length).toBeGreaterThan(10);
    expect(evalRes.body.guard_status).toBe("PASSED");
    expect(evalRes.body.mandatory_disclaimer).toContain("It is not investment advice");

    for (const obs of evalRes.body.observations) {
      const scan = scanSystemAuthoredText(obs.sentence);
      expect(scan.passed).toBe(true);
    }
  });

  it("triggers stop-loss lock-in deterministically when post-entry price drops below threshold", () => {
    const syntheticSeries = [
      { trading_date: "2020-01-01", close: 100, volume: 1000, benchmark_close: 12000 },
      { trading_date: "2020-06-01", close: 110, volume: 1000, benchmark_close: 12500 },
      { trading_date: "2021-01-01", close: 85, volume: 1000, benchmark_close: 13000 }, // -15% from 100 entry
      { trading_date: "2022-01-01", close: 140, volume: 1000, benchmark_close: 15000 },
    ];

    const resultWithStop = evaluatePretendMoneyTimeline({
      ticker: "TESTEQ",
      company_name: "Test Equity Ltd",
      starting_wallet_inr: 100_000,
      stop_loss_pct: 12,
      tranches: [
        {
          id: "t1",
          entry_date: "2020-01-01",
          amount_inr: 50_000,
          label: "Test Entry",
        },
      ],
      series: syntheticSeries,
    });

    expect(resultWithStop.stopped_out_tranche_count).toBe(1);
    expect(resultWithStop.tranches[0]!.status).toBe("STOP_LOSS_TRIGGERED");
    expect(resultWithStop.tranches[0]!.stopped_out_date).toBe("2021-01-01");
    expect(resultWithStop.tranches[0]!.final_value_inr).toBe(42_500);
    expect(resultWithStop.total_portfolio_value_inr).toBe(92_500);

    const resultWithoutStop = evaluatePretendMoneyTimeline({
      ticker: "TESTEQ",
      company_name: "Test Equity Ltd",
      starting_wallet_inr: 100_000,
      stop_loss_pct: null,
      tranches: [
        {
          id: "t1",
          entry_date: "2020-01-01",
          amount_inr: 50_000,
          label: "Test Entry",
        },
      ],
      series: syntheticSeries,
    });

    expect(resultWithoutStop.stopped_out_tranche_count).toBe(0);
    expect(resultWithoutStop.tranches[0]!.status).toBe("ACTIVE_AT_EVAL");
    expect(resultWithoutStop.tranches[0]!.final_value_inr).toBe(70_000);
    expect(resultWithoutStop.total_portfolio_value_inr).toBe(120_000);
  });
});
