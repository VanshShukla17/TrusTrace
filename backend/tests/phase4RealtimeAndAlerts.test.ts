import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/core/env.js";
import { MANDATORY_DISCLAIMER } from "../src/domain/output-guard/guard.js";
import { INFLUENCER_IDS } from "../src/ingestion/demoCorpus.js";
import { parseClaimLedgerWithFreeAiFallback } from "../src/integrations/freeLlmClaimParser.js";
import { clearLiveMarketCache } from "../src/integrations/liveMarketFeed.js";
import {
  buildGuardedWhatsAppSummary,
  decryptSensitiveField,
  encryptSensitiveField,
  maskPhoneNumber,
  sendGuardedWhatsAppAlert,
} from "../src/integrations/whatsappNotifier.js";
import { parseYouTubeAtomXml } from "../src/integrations/youtubeMonitor.js";

function makeYahooChartPayload(symbol: string, price: number, prevClose: number, longName: string) {
  const nowSec = Math.floor(Date.now() / 1000);
  const timestamps: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];
  for (let i = 25; i >= 0; i -= 1) {
    timestamps.push(nowSec - i * 86_400);
    closes.push(Number((prevClose + (25 - i) * 0.8).toFixed(2)));
    volumes.push(4_500_000 + i * 20_000);
  }
  return {
    chart: {
      result: [
        {
          meta: {
            symbol,
            currency: "INR",
            exchangeName: symbol.endsWith(".BO") || symbol === "^BSESN" ? "BSE" : "NSI",
            longName,
            regularMarketPrice: price,
            chartPreviousClose: prevClose,
            regularMarketVolume: 5_200_000,
            regularMarketDayHigh: price + 12,
            regularMarketDayLow: price - 8,
            fiftyTwoWeekHigh: price + 220,
            fiftyTwoWeekLow: price - 180,
            regularMarketTime: nowSec,
            marketCap: 19_500_000_000_000,
          },
          timestamp: timestamps,
          indicators: {
            quote: [{ close: closes, volume: volumes }],
          },
        },
      ],
    },
  };
}

const SAMPLE_YOUTUBE_ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:videoId>vidLive001</yt:videoId>
    <yt:channelId>UC6HlGuJZ0_M_rSgm0hoRhDQ</yt:channelId>
    <title>Wipro Limited breakout review — target 360 in 10 days, SL PAID</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=vidLive001"/>
    <published>2026-11-20T09:30:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/vidLive001/hqdefault.jpg"/>
      <media:description>Guaranteed breakout discussion on Wipro Limited. Target 360 in 10 days. SL PAID in VIP channel.</media:description>
    </media:group>
  </entry>
</feed>`;

describe("Phase 4 — Zero-Cost Real-Time Data, YouTube RSS & Output-Guarded WhatsApp Alerts", () => {
  beforeEach(() => {
    clearLiveMarketCache();
  });

  it("parses official YouTube Atom RSS XML cleanly without social scraping", () => {
    const items = parseYouTubeAtomXml(SAMPLE_YOUTUBE_ATOM_XML);
    expect(items).toHaveLength(1);
    expect(items[0]?.video_id).toBe("vidLive001");
    expect(items[0]?.channel_id).toBe("UC6HlGuJZ0_M_rSgm0hoRhDQ");
    expect(items[0]?.video_url).toBe("https://www.youtube.com/watch?v=vidLive001");
    expect(items[0]?.title).toContain("Wipro Limited");
  });

  it("encrypts and masks subscriber phone numbers safely using AES-256-GCM", () => {
    const secret = "test-32-byte-secret-key-for-phase4-encryption";
    const encrypted = encryptSensitiveField("+919876543210", secret);
    expect(encrypted).not.toContain("9876543210");
    expect(decryptSensitiveField(encrypted, secret)).toBe("+919876543210");
    expect(maskPhoneNumber("+919876543210")).toBe("+91******3210");
  });

  it("validates free-tier AI claim extraction against verbatim source spans and rejects hallucinations", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      stock: "Reliance Industries",
                      stock_quote: "Reliance Industries",
                      direction: "BULLISH",
                      direction_quote: "breakout",
                      target_price: 9999,
                      target_quote: "hallucinated quote not in source",
                      deadline: "15 days",
                      deadline_quote: "15 days",
                      stop_loss: null,
                      stop_loss_gated: true,
                      stop_loss_quote: "SL PAID",
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const result = await parseClaimLedgerWithFreeAiFallback({
      sourceText: "Reliance Industries breakout over 15 days, SL PAID",
      catalogue: [],
      llmProvider: "gemini",
      llmApiKey: "fake-free-tier-key",
      fetchImpl: mockFetch,
    });

    expect(result.engine).toBe("FREE_LLM_GEMINI");
    expect(result.claims.stock.value).toBe("Reliance Industries");
    expect(result.claims.stock.status).toBe("EXTRACTED");
    // Hallucinated target_price quote MUST be rejected!
    expect(result.claims.target_price.status).toBe("NOT_STATED");
    expect(result.claims.target_price.value).toBeNull();
    expect(result.claims.stop_loss.gated).toBe(true);
  });

  it("blocks adversarial advice language in automated WhatsApp alerts and never dispatches unsafe text", async () => {
    const fetchSpy = vi.fn();
    const unsafePhrases = [
      "You should buy Wipro Limited right now for strong upside.",
      "Target price 500 — undervalued multibagger!",
      "Abhi kharid lo, pakka badhega!",
      "This creator is a scammer and fraudster.",
    ];

    for (const phrase of unsafePhrases) {
      const delivery = await sendGuardedWhatsAppAlert({
        phoneE164: "+919876543210",
        provider: "callmebot",
        callMeBotApiKey: "test-key",
        message: `${phrase}\n\n${MANDATORY_DISCLAIMER}`,
        fetchImpl: fetchSpy as unknown as typeof fetch,
      });
      expect(delivery.status).toBe("BLOCKED_BY_GUARD");
    }

    // Also block messages missing the verbatim mandatory disclaimer
    const noDisclaimer = await sendGuardedWhatsAppAlert({
      phoneE164: "+919876543210",
      provider: "callmebot",
      callMeBotApiKey: "test-key",
      message: "Tip Autopsy Evidence Alert: SEBI snapshot status is Registered.",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(noDisclaimer.status).toBe("BLOCKED_BY_GUARD");
    expect(noDisclaimer.errorCode).toBe("MISSING_MANDATORY_DISCLAIMER");
    expect(fetchSpy).not.toHaveBeenCalled();

    // Verify buildGuardedWhatsAppSummary blocks injected unsafe lines too
    const blocked = buildGuardedWhatsAppSummary({
      influencerName: "Rakesh Bansal",
      videoTitle: "Wipro review",
      videoUrl: "https://www.youtube.com/watch?v=abc123",
      publishedAtIso: "2026-11-20T10:00:00Z",
      transcriptSource: "METADATA_ONLY",
      detectedTicker: "WIPRO",
      sebi: {
        query: "Rakesh Bansal",
        status: "REGISTERED",
        matched_name: "Rakesh Bansal",
        registration_no: "INH100008984",
        category: "Research Analyst",
        snapshot_id: "snap-1",
        snapshot_date: "2026-11-18",
        data_label: "MIXED",
        explanation: "Matched.",
        candidates_considered: 2,
      },
      report: {
        report_version: "facts-card-v1",
        guard_status: "PASSED",
        guard_blocked_reason: null,
        information_verdict_title: "Information & Evidence Verdict",
        sections: [],
        creator_quoted_claim: {
          label: "Creator's claim",
          quoted_text: null,
          target_price_claimed: null,
          disclaimer: "Quoted directly.",
        },
        provenance_summary: { snapshot_ids: [], as_of_dates: [], data_labels: [] },
        mandatory_disclaimer: MANDATORY_DISCLAIMER,
      },
      injectedUnsafeLine: "Strong buy right now for guaranteed returns.",
    });
    expect(blocked.guardStatus).toBe("BLOCKED_FALLBACK");
    expect(blocked.text).toContain(MANDATORY_DISCLAIMER);
  });

  it("serves real-time NSE/BSE quotes, search, and detail with graceful snapshot fallback", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("%5ENSEI")) {
        return new Response(
          JSON.stringify(makeYahooChartPayload("^NSEI", 25800.6, 25650.0, "NIFTY 50")),
          { status: 200 }
        );
      }
      if (url.includes("%5EBSESN")) {
        return new Response(
          JSON.stringify(makeYahooChartPayload("^BSESN", 84120.5, 83900.0, "SENSEX")),
          { status: 200 }
        );
      }
      if (url.includes("%5ENSEBANK")) {
        return new Response(
          JSON.stringify(makeYahooChartPayload("^NSEBANK", 54320.0, 54100.0, "BANKNIFTY")),
          { status: 200 }
        );
      }
      if (url.includes("RELIANCE.NS")) {
        return new Response(
          JSON.stringify(
            makeYahooChartPayload("RELIANCE.NS", 1425.5, 1410.0, "Reliance Industries Ltd")
          ),
          { status: 200 }
        );
      }
      if (url.includes("/v1/finance/search")) {
        return new Response(
          JSON.stringify({
            quotes: [
              {
                symbol: "RELIANCE.NS",
                exchange: "NSI",
                quoteType: "EQUITY",
                longname: "Reliance Industries Limited",
                sector: "Energy",
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const app = createApp({
      config: loadEnv({ NODE_ENV: "test", LIVE_MARKET_ENABLED: "true" }),
      fetchImpl: mockFetch,
    });

    const quotesRes = await request(app).get("/api/live/stocks/quotes?tickers=RELIANCE");
    expect(quotesRes.status).toBe(200);
    expect(quotesRes.body.feed_status).toBe("LIVE_FEED");
    expect(quotesRes.body.quotes[0].ticker).toBe("RELIANCE");
    expect(quotesRes.body.quotes[0].price).toBe(1425.5);
    expect(quotesRes.body.quotes[0].data_freshness).toBe("LIVE_FEED");

    const searchRes = await request(app).get("/api/live/stocks/search?q=RELIANCE");
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.items.some((i: { ticker: string }) => i.ticker === "RELIANCE")).toBe(true);

    const detailRes = await request(app).get("/api/live/stocks/RELIANCE/detail?range=1mo");
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.quote.ticker).toBe("RELIANCE");
    expect(detailRes.body.series.length).toBeGreaterThan(10);

    // Also verify existing /api/stocks/:ticker/checks resolves live non-corpus stock RELIANCE cleanly
    const checksRes = await request(app).get("/api/stocks/RELIANCE/checks");
    expect(checksRes.status).toBe(200);
    expect(checksRes.body.ticker).toBe("RELIANCE");
    expect(checksRes.body.checks).toHaveLength(5);

    // Verify graceful fallback when Yahoo Finance fails completely
    clearLiveMarketCache();
    const failingFetch = vi.fn(async () => new Response("Rate limited", { status: 429 })) as unknown as typeof fetch;
    const fallbackApp = createApp({
      config: loadEnv({ NODE_ENV: "test", LIVE_MARKET_ENABLED: "true" }),
      fetchImpl: failingFetch,
    });
    const fallbackQuotes = await request(fallbackApp).get("/api/live/stocks/quotes?tickers=WIPRO");
    expect(fallbackQuotes.status).toBe(200);
    expect(fallbackQuotes.body.feed_status).toBe("SNAPSHOT_FALLBACK");
    expect(fallbackQuotes.body.quotes[0].data_freshness).toBe("DATED_SNAPSHOT");
  });

  it("runs the full Finfluencer subscribe -> YouTube RSS sync -> guarded WhatsApp alert -> idempotency -> unsubscribe flow", async () => {
    const callMeBotCalls: string[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("youtube.com/feeds/videos.xml")) {
        return new Response(SAMPLE_YOUTUBE_ATOM_XML, {
          status: 200,
          headers: { "Content-Type": "application/atom+xml" },
        });
      }
      if (url.includes("youtube.com/api/timedtext")) {
        return new Response("", { status: 404 });
      }
      if (url.includes("api.callmebot.com/whatsapp.php")) {
        callMeBotCalls.push(url);
        return new Response("Message queued", { status: 200 });
      }
      if (url.includes("WIPRO.NS")) {
        return new Response(
          JSON.stringify(makeYahooChartPayload("WIPRO.NS", 185.7, 182.1, "Wipro Limited")),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const app = createApp({
      config: loadEnv({
        NODE_ENV: "test",
        LIVE_MARKET_ENABLED: "true",
        SUBSCRIPTION_ENCRYPTION_KEY: "test-encryption-key-minimum-32-chars",
      }),
      fetchImpl: mockFetch,
    });

    // 1. Directory lists finfluencers with SEBI status
    const dirRes = await request(app).get("/api/finfluencers");
    expect(dirRes.status).toBe(200);
    expect(dirRes.body.items.length).toBeGreaterThanOrEqual(6);

    // 2. Subscribe requires explicit consent
    const badSub = await request(app)
      .post(`/api/finfluencers/${INFLUENCER_IDS.RAKESH_BANSAL}/subscribe`)
      .send({ phone: "+919876543210", provider: "dry_run", consent_accepted: false });
    expect(badSub.status).toBe(400);

    // 3. Subscribe with CallMeBot zero-cost free key
    const subRes = await request(app)
      .post(`/api/finfluencers/${INFLUENCER_IDS.RAKESH_BANSAL}/subscribe`)
      .send({
        phone: "+919876543210",
        provider: "callmebot",
        callmebot_api_key: "free-key-123",
        consent_accepted: true,
      });
    expect(subRes.status).toBe(201);
    expect(subRes.body.subscription.phone_masked).toBe("+91******3210");
    expect(JSON.stringify(subRes.body)).not.toContain("9876543210");
    expect(JSON.stringify(subRes.body)).not.toContain("free-key-123");
    const subId = subRes.body.subscription.id as string;
    const unsubToken = subRes.body.subscription.unsubscribe_token as string;

    // 4. Trigger real-time YouTube RSS sync -> analyzes video + dispatches 1 Output-Guarded WhatsApp alert
    const syncRes = await request(app).post(
      `/api/finfluencers/${INFLUENCER_IDS.RAKESH_BANSAL}/sync`
    );
    expect(syncRes.status).toBe(200);
    expect(syncRes.body.newly_analyzed).toBe(1);
    expect(syncRes.body.alerts_dispatched).toBe(1);
    expect(syncRes.body.videos[0].video_id).toBe("vidLive001");
    expect(syncRes.body.videos[0].guard_status).toBe("PASSED");
    expect(syncRes.body.videos[0].whatsapp_summary_text).toContain(MANDATORY_DISCLAIMER);
    expect(callMeBotCalls).toHaveLength(1);

    // 5. Re-syncing the same RSS feed is idempotent (0 new videos, 0 duplicate WhatsApp alerts)
    const secondSync = await request(app).post(
      `/api/finfluencers/${INFLUENCER_IDS.RAKESH_BANSAL}/sync`
    );
    expect(secondSync.status).toBe(200);
    expect(secondSync.body.newly_analyzed).toBe(0);
    expect(secondSync.body.alerts_dispatched).toBe(0);
    expect(callMeBotCalls).toHaveLength(1);

    // 6. Test Alert endpoint works for an active subscription
    const testAlertRes = await request(app)
      .post(`/api/finfluencers/${INFLUENCER_IDS.RAKESH_BANSAL}/test-alert`)
      .send({ subscription_id: subId });
    expect(testAlertRes.status).toBe(200);
    expect(testAlertRes.body.delivery_status).toBe("SENT");
    expect(testAlertRes.body.message_preview).toContain(MANDATORY_DISCLAIMER);

    // 7. WebSub verification challenge echoes cleanly
    const websubVerify = await request(app).get(
      "/api/webhooks/youtube?hub.challenge=challenge_token_123"
    );
    expect(websubVerify.status).toBe(200);
    expect(websubVerify.text).toBe("challenge_token_123");

    // 8. One-click unsubscribe deactivates subscription
    const unsubRes = await request(app)
      .post("/api/finfluencers/unsubscribe")
      .send({ token: unsubToken });
    expect(unsubRes.status).toBe(200);
    expect(unsubRes.body.unsubscribed).toBe(true);
    expect(unsubRes.body.phone_masked).toBe("+91******3210");
  });

  it("dispatches Output-Guarded WhatsApp alerts via Twilio Programmable Messaging API", async () => {
    const twilioCalls: Array<{ url: string; body: string; auth: string | null }> = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.twilio.com/2010-04-01/Accounts/AC_TEST_123/Messages.json")) {
        const headers = init?.headers as Record<string, string> | undefined;
        twilioCalls.push({
          url,
          body: String(init?.body ?? ""),
          auth: headers?.Authorization ?? null,
        });
        return new Response(JSON.stringify({ sid: "SM12345", status: "queued" }), { status: 201 });
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const safeBody = `Tip Autopsy · Real-Time YouTube Evidence Alert\nCreator: Rakesh Bansal\nSEBI Snapshot: Registered (INH100008984)\n\n${MANDATORY_DISCLAIMER}`;

    const sent = await sendGuardedWhatsAppAlert({
      phoneE164: "+919876543210",
      provider: "twilio",
      message: safeBody,
      twilioAccountSid: "AC_TEST_123",
      twilioAuthToken: "secret_auth_token",
      twilioWhatsAppFrom: "whatsapp:+14155238886",
      fetchImpl: mockFetch,
    });

    expect(sent.status).toBe("SENT");
    expect(sent.provider).toBe("twilio");
    expect(twilioCalls).toHaveLength(1);
    expect(twilioCalls[0]?.body).toContain("From=whatsapp%3A%2B14155238886");
    expect(twilioCalls[0]?.body).toContain("To=whatsapp%3A%2B919876543210");
    expect(twilioCalls[0]?.auth).toMatch(/^Basic /);

    // Unsafe recommendation MUST be blocked before reaching Twilio
    const blocked = await sendGuardedWhatsAppAlert({
      phoneE164: "+919876543210",
      provider: "twilio",
      message: `Buy WIPRO right now for guaranteed returns!\n\n${MANDATORY_DISCLAIMER}`,
      twilioAccountSid: "AC_TEST_123",
      twilioAuthToken: "secret_auth_token",
      fetchImpl: mockFetch,
    });
    expect(blocked.status).toBe("BLOCKED_BY_GUARD");
    expect(twilioCalls).toHaveLength(1);
  });
});
