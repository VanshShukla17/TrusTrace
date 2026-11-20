import type {
  DataLabel,
  DisclosureGrade,
  Exchange,
  InstrumentType,
  SebiRegisterEntryRecord,
  SizeBand,
  TipDirection,
} from "../domain/types.js";
import type {
  PriceBar,
  StockInfoSnapshot,
  SurveillanceSnapshot,
} from "../domain/market-checks/checks.js";
import { normalizeIdentifier } from "../domain/sebi/lookup.js";
import { computePayloadChecksum } from "./validator.js";

export interface SnapshotRecord {
  id: string;
  dataset_key: string;
  source_name: string;
  source_url: string | null;
  as_of_date: string;
  retrieved_at: string;
  data_label: DataLabel;
  version: string;
  checksum: string;
  row_count: number;
  validation_status: "VALID" | "PARTIAL" | "REJECTED";
  notes: string | null;
}

export interface InfluencerRecord {
  id: string;
  name: string;
  handle: string | null;
  aliases: string[];
  normalized_name: string;
  sebi_registration_no: string | null;
  youtube_channel_id?: string | null;
  youtube_handle?: string | null;
  youtube_channel_url?: string | null;
  avatar_initials?: string | null;
  bio_summary?: string | null;
}

export interface StockRecord {
  ticker: string;
  company_name: string;
  exchange: Exchange;
  instrument_type: InstrumentType;
  underlying_ticker: string | null;
  circuit_band: string | null;
  aliases: string[];
}

export interface BenchmarkBarRecord {
  benchmark_key: "NIFTY_50" | "SENSEX" | "BANKNIFTY";
  trading_date: string;
  close: number;
  snapshot_id: string;
  source_name: string;
  data_label: DataLabel;
}

export interface CuratedTipRecord {
  id: string;
  influencer_id: string;
  ticker: string;
  tip_date: string;
  text: string;
  direction: TipDirection;
  target_price: number | null;
  deadline: string | null;
  stop_loss: number | null;
  disclosure_grade: DisclosureGrade;
  source_url: string | null;
  media_asset_path: string | null;
  is_synthetic: boolean;
  snapshot_id: string;
  data_label: DataLabel;
}

export interface DemoCaseMeta {
  id: string;
  influencer_id: string;
  influencer_name: string;
  alias: string | null;
  ticker: string;
  instrument_name: string;
  instrument_type: InstrumentType;
  underlying_ticker: string | null;
  media_type: "PHOTO" | "VIDEO";
  media_path: string;
  tip_date: string;
  sample_text: string;
  sebi_expected_status: "REGISTERED" | "NOT_FOUND";
  data_label: DataLabel;
  coverage_note: string;
}

// Deterministic UUIDs for reproducible snapshots & fixtures
export const SNAPSHOT_IDS = {
  SEBI: "11111111-1111-4111-8111-111111111101",
  PRICES: "11111111-1111-4111-8111-111111111102",
  BENCHMARKS: "11111111-1111-4111-8111-111111111103",
  STOCK_INFO: "11111111-1111-4111-8111-111111111104",
  SURVEILLANCE: "11111111-1111-4111-8111-111111111105",
  TIPS: "11111111-1111-4111-8111-111111111106",
} as const;

export const INFLUENCER_IDS = {
  ASHISH_KYAL: "22222222-2222-4222-8222-222222222201",
  CHINMAY_DUDHANE: "22222222-2222-4222-8222-222222222202",
  HARSH_BHAGAT: "22222222-2222-4222-8222-222222222203",
  RAKESH_BANSAL: "22222222-2222-4222-8222-222222222204",
  VIVEK_RANA: "22222222-2222-4222-8222-222222222205",
  DEMO_HIGH_VOLUME_CREATOR: "22222222-2222-4222-8222-222222222206",
  CA_RACHANA_RANADE: "22222222-2222-4222-8222-222222222207",
  PRANJAL_KAMRA: "22222222-2222-4222-8222-222222222208",
} as const;

/** Generates weekday trading dates between 2026-09-14 and 2026-11-19 (49 trading sessions). */
function generateTradingDates(): string[] {
  const dates: string[] = [];
  const start = new Date("2026-09-14T00:00:00Z");
  const end = new Date("2026-11-19T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

export const DEMO_TRADING_DATES = generateTradingDates();

export interface DemoDataset {
  snapshots: SnapshotRecord[];
  influencers: InfluencerRecord[];
  sebiEntries: SebiRegisterEntryRecord[];
  stocks: StockRecord[];
  pricesByTicker: Record<string, PriceBar[]>;
  stockInfoByTicker: Record<string, StockInfoSnapshot>;
  surveillanceByTicker: Record<string, SurveillanceSnapshot[]>;
  benchmarks: Record<"NIFTY_50" | "SENSEX" | "BANKNIFTY", BenchmarkBarRecord[]>;
  tips: CuratedTipRecord[];
  demoCases: DemoCaseMeta[];
}

export function buildDemoDataset(): DemoDataset {
  const dates = DEMO_TRADING_DATES;
  const asOfDate = dates[dates.length - 1]!; // 2026-11-19

  const influencers: InfluencerRecord[] = [
    {
      id: INFLUENCER_IDS.RAKESH_BANSAL,
      name: "Rakesh Bansal",
      handle: "@iamrakeshbansal",
      aliases: ["Dr Rakesh Bansal", "Rakesh Bansal Ventures"],
      normalized_name: normalizeIdentifier("Rakesh Bansal"),
      sebi_registration_no: "INH100008984",
      youtube_channel_id: "UC6HlGuJZ0_M_rSgm0hoRhDQ",
      youtube_handle: "@iamrakeshbansal",
      youtube_channel_url: "https://www.youtube.com/channel/UC6HlGuJZ0_M_rSgm0hoRhDQ",
      avatar_initials: "RB",
      bio_summary:
        "SEBI-registered Research Analyst in curated snapshot; publishes Hindi/Hinglish equity & chart breakdowns on YouTube.",
    },
    {
      id: INFLUENCER_IDS.CA_RACHANA_RANADE,
      name: "CA Rachana Ranade",
      handle: "@CARachanaRanade",
      aliases: ["Rachana Ranade", "CA Rachana Phadke Ranade"],
      normalized_name: normalizeIdentifier("CA Rachana Ranade"),
      sebi_registration_no: null,
      youtube_channel_id: "UCe3qdG0A_gr-sEdat5y2twQ",
      youtube_handle: "@CARachanaRanade",
      youtube_channel_url: "https://www.youtube.com/channel/UCe3qdG0A_gr-sEdat5y2twQ",
      avatar_initials: "RR",
      bio_summary:
        "Indian retail finance educator covering IPOs, stock fundamentals, and personal finance on YouTube.",
    },
    {
      id: INFLUENCER_IDS.PRANJAL_KAMRA,
      name: "Pranjal Kamra",
      handle: "@pranjalkamra",
      aliases: ["Finology", "Finology Ventures"],
      normalized_name: normalizeIdentifier("Pranjal Kamra"),
      sebi_registration_no: null,
      youtube_channel_id: "UCwAdQUuPT6laN-AQR17fe1g",
      youtube_handle: "@pranjalkamra",
      youtube_channel_url: "https://www.youtube.com/channel/UCwAdQUuPT6laN-AQR17fe1g",
      avatar_initials: "PK",
      bio_summary:
        "Indian equity investing and mutual fund educator publishing market explainers on YouTube.",
    },
    {
      id: INFLUENCER_IDS.ASHISH_KYAL,
      name: "Ashish Kyal",
      handle: "@ashishkyal_demo",
      aliases: ["Waves Strategy"],
      normalized_name: normalizeIdentifier("Ashish Kyal"),
      sebi_registration_no: null,
      youtube_channel_id: null,
      youtube_handle: "@kyalashish",
      youtube_channel_url: "https://www.youtube.com/@kyalashish",
      avatar_initials: "AK",
      bio_summary: "Technical analysis and index derivatives commentary (Waves Strategy).",
    },
    {
      id: INFLUENCER_IDS.CHINMAY_DUDHANE,
      name: "Chinmay Dudhane",
      handle: "@tradingcafeindia",
      aliases: ["Trading cafe India", "Trading Cafe India"],
      normalized_name: normalizeIdentifier("Chinmay Dudhane"),
      sebi_registration_no: "INH000012948",
      youtube_channel_id: null,
      youtube_handle: "@tradingcafeindia",
      youtube_channel_url: "https://www.youtube.com/@tradingcafeindia",
      avatar_initials: "CD",
      bio_summary: "Founder of Trading Cafe India; options and market structure content.",
    },
    {
      id: INFLUENCER_IDS.HARSH_BHAGAT,
      name: "Harsh Bhagat",
      handle: "@harshbhagat_demo",
      aliases: ["Harsh Bhagat Options"],
      normalized_name: normalizeIdentifier("Harsh Bhagat"),
      sebi_registration_no: null,
      youtube_channel_id: null,
      youtube_handle: null,
      youtube_channel_url: null,
      avatar_initials: "HB",
      bio_summary: "Index options trading commentary.",
    },
    {
      id: INFLUENCER_IDS.VIVEK_RANA,
      name: "Vivek Rana",
      handle: "@vivekrana_demo",
      aliases: [],
      normalized_name: normalizeIdentifier("Vivek Rana"),
      sebi_registration_no: null,
      youtube_channel_id: null,
      youtube_handle: null,
      youtube_channel_url: null,
      avatar_initials: "VR",
      bio_summary: "Short-form equity commentary clips.",
    },
    {
      id: INFLUENCER_IDS.DEMO_HIGH_VOLUME_CREATOR,
      name: "Aarav FinNotes (Synthetic Demo)",
      handle: "@aaravfinnotes_synthetic",
      aliases: ["Aarav FinNotes"],
      normalized_name: normalizeIdentifier("Aarav FinNotes (Synthetic Demo)"),
      sebi_registration_no: null,
      youtube_channel_id: null,
      youtube_handle: null,
      youtube_channel_url: null,
      avatar_initials: "AF",
      bio_summary:
        "Synthetic demo creator seeded exclusively for Beta-Binomial track-record evaluation.",
    },
  ];

  const sebiEntries: SebiRegisterEntryRecord[] = [
    {
      id: "33333333-3333-4333-8333-333333333301",
      snapshot_id: SNAPSHOT_IDS.SEBI,
      name: "Chinmay Dudhane",
      normalized_name: normalizeIdentifier("Chinmay Dudhane"),
      registration_no: "INH000012948",
      category: "Research Analyst",
      snapshot_date: "2026-11-18",
    },
    {
      id: "33333333-3333-4333-8333-333333333302",
      snapshot_id: SNAPSHOT_IDS.SEBI,
      name: "Rakesh Bansal",
      normalized_name: normalizeIdentifier("Rakesh Bansal"),
      registration_no: "INH100008984",
      category: "Research Analyst",
      snapshot_date: "2026-11-18",
    },
  ];

  const stocks: StockRecord[] = [
    {
      ticker: "BORORENEW",
      company_name: "Borosil Renewables Ltd",
      exchange: "NSE",
      instrument_type: "EQUITY",
      underlying_ticker: null,
      circuit_band: "5%",
      aliases: ["Borosil Renewables", "Borosil Renewables Limited", "BORORENEW"],
    },
    {
      ticker: "SARVESHWAR",
      company_name: "Sarveshwar Foods Ltd",
      exchange: "NSE",
      instrument_type: "EQUITY",
      underlying_ticker: null,
      circuit_band: "5%",
      aliases: ["Sarveshwar Foods", "Sarveshwar", "SARVESHWAR"],
    },
    {
      ticker: "WIPRO",
      company_name: "Wipro Limited",
      exchange: "NSE",
      instrument_type: "EQUITY",
      underlying_ticker: null,
      circuit_band: "20%",
      aliases: ["Wipro", "Wipro Ltd", "WIPRO"],
    },
    {
      ticker: "SENSEX_82900_CE",
      company_name: "Sensex 82900 CE",
      exchange: "BSE",
      instrument_type: "DERIVATIVE",
      underlying_ticker: "SENSEX",
      circuit_band: null,
      aliases: ["Sensex 82900 CE", "SENSEX 82900CE", "82900 CE"],
    },
    {
      ticker: "NIFTY_25500_CE",
      company_name: "Nifty 25500 CE",
      exchange: "NSE",
      instrument_type: "DERIVATIVE",
      underlying_ticker: "NIFTY_50",
      circuit_band: null,
      aliases: ["Nifty 25500 CE", "NIFTY 25500CE", "25500 CE"],
    },
    {
      ticker: "NIFTY_25600_CE",
      company_name: "Nifty 25600 CE",
      exchange: "NSE",
      instrument_type: "DERIVATIVE",
      underlying_ticker: "NIFTY_50",
      circuit_band: null,
      aliases: ["Nifty 25600 CE", "NIFTY 25600CE", "25600 CE"],
    },
  ];

  // Build deterministic synthetic historical price/volume series (strictly labelled SYNTHETIC!)
  const pricesByTicker: Record<string, PriceBar[]> = {
    BORORENEW: [],
    SARVESHWAR: [],
    WIPRO: [],
  };

  const benchmarks: DemoDataset["benchmarks"] = {
    NIFTY_50: [],
    SENSEX: [],
    BANKNIFTY: [],
  };

  dates.forEach((trading_date, i) => {
    // Benchmarks (steady realistic synthetic index trajectories)
    const niftyClose = Number((24200 + i * 11.5 + Math.sin(i * 0.45) * 95).toFixed(2));
    const sensexClose = Number((79500 + i * 36.2 + Math.sin(i * 0.42) * 280).toFixed(2));
    const bankNiftyClose = Number((52600 + i * 24.8 + Math.cos(i * 0.4) * 210).toFixed(2));

    benchmarks.NIFTY_50.push({
      benchmark_key: "NIFTY_50",
      trading_date,
      close: niftyClose,
      snapshot_id: SNAPSHOT_IDS.BENCHMARKS,
      source_name: "Tip Autopsy Synthetic Demo Benchmarks (NSE/BSE replacement ready)",
      data_label: "SYNTHETIC",
    });
    benchmarks.SENSEX.push({
      benchmark_key: "SENSEX",
      trading_date,
      close: sensexClose,
      snapshot_id: SNAPSHOT_IDS.BENCHMARKS,
      source_name: "Tip Autopsy Synthetic Demo Benchmarks (NSE/BSE replacement ready)",
      data_label: "SYNTHETIC",
    });
    benchmarks.BANKNIFTY.push({
      benchmark_key: "BANKNIFTY",
      trading_date,
      close: bankNiftyClose,
      snapshot_id: SNAPSHOT_IDS.BENCHMARKS,
      source_name: "Tip Autopsy Synthetic Demo Benchmarks (NSE/BSE replacement ready)",
      data_label: "SYNTHETIC",
    });

    // BORORENEW: pre-tip run-up in early Nov + volume spike on 2026-11-10 (index ~41)
    const boroBase = 510 + (i < 35 ? i * 0.9 : 31.5 + (i - 35) * 14.2);
    const boroClose = Number((i > 42 ? boroBase - (i - 42) * 11.5 : boroBase).toFixed(2));
    const boroVol = trading_date === "2026-11-10" ? 960_000 : 185_000 + ((i * 7919) % 45_000);
    pricesByTicker.BORORENEW!.push({
      trading_date,
      close: boroClose,
      volume: boroVol,
      snapshot_id: SNAPSHOT_IDS.PRICES,
      source_name: "Tip Autopsy Synthetic Demo Equity Series (Real NSE CSV loader ready)",
      data_label: "SYNTHETIC",
    });

    // SARVESHWAR: low-liquidity micro-cap with sharp pre-tip run-up + volume spike on 2026-11-12
    const sarvBase = 8.4 + (i < 37 ? i * 0.04 : 1.48 + (i - 37) * 0.34);
    const sarvClose = Number((i > 43 ? sarvBase - (i - 43) * 0.42 : sarvBase).toFixed(2));
    const sarvVol = trading_date === "2026-11-12" ? 4_800_000 : 820_000 + ((i * 3571) % 160_000);
    pricesByTicker.SARVESHWAR!.push({
      trading_date,
      close: sarvClose,
      volume: sarvVol,
      snapshot_id: SNAPSHOT_IDS.PRICES,
      source_name: "Tip Autopsy Synthetic Demo Equity Series (Real NSE CSV loader ready)",
      data_label: "SYNTHETIC",
    });

    // WIPRO: liquid large-cap with calm volume & modest moves (normal range contrast!)
    const wiproClose = Number((548 + i * 0.65 + Math.sin(i * 0.35) * 6.5).toFixed(2));
    const wiproVol = 6_400_000 + ((i * 12497) % 1_100_000);
    pricesByTicker.WIPRO!.push({
      trading_date,
      close: wiproClose,
      volume: wiproVol,
      snapshot_id: SNAPSHOT_IDS.PRICES,
      source_name: "Tip Autopsy Synthetic Demo Equity Series (Real NSE CSV loader ready)",
      data_label: "SYNTHETIC",
    });
  });

  const stockInfoByTicker: Record<string, StockInfoSnapshot> = {
    BORORENEW: {
      ticker: "BORORENEW",
      market_cap: 7250.0,
      size_band: "SMALL" as SizeBand,
      circuit_band: "5%",
      as_of_date: "2026-11-18",
      snapshot_id: SNAPSHOT_IDS.STOCK_INFO,
      source_name: "Tip Autopsy Synthetic Demo Market Cap Snapshot",
      data_label: "SYNTHETIC",
      classification_version: "amfi-size-band-v1",
    },
    SARVESHWAR: {
      ticker: "SARVESHWAR",
      market_cap: 940.0,
      size_band: "MICRO" as SizeBand,
      circuit_band: "5%",
      as_of_date: "2026-11-18",
      snapshot_id: SNAPSHOT_IDS.STOCK_INFO,
      source_name: "Tip Autopsy Synthetic Demo Market Cap Snapshot",
      data_label: "SYNTHETIC",
      classification_version: "amfi-size-band-v1",
    },
    WIPRO: {
      ticker: "WIPRO",
      market_cap: 294500.0,
      size_band: "LARGE" as SizeBand,
      circuit_band: "20%",
      as_of_date: "2026-11-18",
      snapshot_id: SNAPSHOT_IDS.STOCK_INFO,
      source_name: "Tip Autopsy Synthetic Demo Market Cap Snapshot",
      data_label: "SYNTHETIC",
      classification_version: "amfi-size-band-v1",
    },
  };

  const surveillanceByTicker: Record<string, SurveillanceSnapshot[]> = {
    BORORENEW: [
      {
        ticker: "BORORENEW",
        list_name: "ASM Stage 1",
        is_active: true,
        snapshot_date: "2026-11-18",
        snapshot_id: SNAPSHOT_IDS.SURVEILLANCE,
        source_name: "Tip Autopsy Synthetic Demo Surveillance Snapshot",
        data_label: "SYNTHETIC",
      },
    ],
    SARVESHWAR: [
      {
        ticker: "SARVESHWAR",
        list_name: "ASM Stage 4",
        is_active: true,
        snapshot_date: "2026-11-18",
        snapshot_id: SNAPSHOT_IDS.SURVEILLANCE,
        source_name: "Tip Autopsy Synthetic Demo Surveillance Snapshot",
        data_label: "SYNTHETIC",
      },
    ],
    WIPRO: [
      {
        ticker: "WIPRO",
        list_name: "ASM",
        is_active: false,
        snapshot_date: "2026-11-18",
        snapshot_id: SNAPSHOT_IDS.SURVEILLANCE,
        source_name: "Tip Autopsy Synthetic Demo Surveillance Snapshot",
        data_label: "SYNTHETIC",
      },
    ],
  };

  const demoCases: DemoCaseMeta[] = [
    {
      id: "ashish-kyal-sensex-82900-ce",
      influencer_id: INFLUENCER_IDS.ASHISH_KYAL,
      influencer_name: "Ashish Kyal",
      alias: null,
      ticker: "SENSEX_82900_CE",
      instrument_name: "Sensex 82900 CE",
      instrument_type: "DERIVATIVE",
      underlying_ticker: "SENSEX",
      media_type: "PHOTO",
      media_path: "/media/photos/Ashish_Kyal__Sensex_82900_CE__Not_Registered.jpeg",
      tip_date: "2026-11-10",
      sample_text:
        "SENSEX 82900 CE BUY ABOVE 310 TGT 380 / 430 Intraday. SL PAID. Join my Telegram for full levels!",
      sebi_expected_status: "NOT_FOUND",
      data_label: "MIXED",
      coverage_note:
        "Index option screenshot. Equity-only checks return Could not verify; gated stop-loss (SL PAID) flagged as Not stated.",
    },
    {
      id: "chinmay-dudhane-nifty-25500-ce",
      influencer_id: INFLUENCER_IDS.CHINMAY_DUDHANE,
      influencer_name: "Chinmay Dudhane",
      alias: "Trading cafe India",
      ticker: "NIFTY_25500_CE",
      instrument_name: "Nifty 25500 CE",
      instrument_type: "DERIVATIVE",
      underlying_ticker: "NIFTY_50",
      media_type: "PHOTO",
      media_path: "/media/photos/Chinmay_Dudhane__Nifty_25500_CE__Registered.jpeg",
      tip_date: "2026-11-11",
      sample_text:
        "Trading cafe India: NIFTY 25500 CE Buy above 145 Target 190 Intraday. SL- Paid. SEBI Reg No INH000012948.",
      sebi_expected_status: "REGISTERED",
      data_label: "MIXED",
      coverage_note:
        "Alias maps conservatively to registered Research Analyst snapshot. Equity checks return Could not verify for options.",
    },
    {
      id: "harsh-bhagat-nifty-25600-ce",
      influencer_id: INFLUENCER_IDS.HARSH_BHAGAT,
      influencer_name: "Harsh Bhagat",
      alias: null,
      ticker: "NIFTY_25600_CE",
      instrument_name: "Nifty 25600 CE",
      instrument_type: "DERIVATIVE",
      underlying_ticker: "NIFTY_50",
      media_type: "PHOTO",
      media_path: "/media/photos/Harsh_Bhagat__Nifty_25600_CE__Not_Registered.jpeg",
      tip_date: "2026-11-12",
      sample_text:
        "NIFTY 25600 CE Guaranteed jackpot call! Buy 120 Target 210 Intraday. SL. VIP PREMIUM. DM for Account Handling & double money!",
      sebi_expected_status: "NOT_FOUND",
      data_label: "MIXED",
      coverage_note:
        "Contains gated stop-loss (SL. VIP PREMIUM), urgency/return promises, and account-handling cues; derivative checks return Could not verify.",
    },
    {
      id: "rakesh-bansal-borosil-renewables",
      influencer_id: INFLUENCER_IDS.RAKESH_BANSAL,
      influencer_name: "Rakesh Bansal",
      alias: null,
      ticker: "BORORENEW",
      instrument_name: "Borosil Renewables Ltd",
      instrument_type: "EQUITY",
      underlying_ticker: null,
      media_type: "VIDEO",
      media_path: "/media/videos/Rakesh_Bansal__Borosil_Renewables_Ltd__Registered.App.mp4",
      tip_date: "2026-11-10",
      sample_text:
        "Borosil Renewables Ltd breakout dikh raha hai — Buy above 615, Target 740 in 15 days. Educational purpose only, SEBI Registered RA INH100008984.",
      sebi_expected_status: "REGISTERED",
      data_label: "MIXED",
      coverage_note:
        "Cash equity video clip. Synthetic demo series demonstrates pre-tip run-up, volume spike, ASM Stage 1, and missing stop-loss.",
    },
    {
      id: "rakesh-bansal-sarveshwar-foods",
      influencer_id: INFLUENCER_IDS.RAKESH_BANSAL,
      influencer_name: "Rakesh Bansal",
      alias: null,
      ticker: "SARVESHWAR",
      instrument_name: "Sarveshwar Foods Ltd",
      instrument_type: "EQUITY",
      underlying_ticker: null,
      media_type: "VIDEO",
      media_path: "/media/videos/Rakesh_Bansal__Sarveshwar_Foods__Registered.App.mp4",
      tip_date: "2026-11-12",
      sample_text:
        "Sarveshwar Foods multibagger potential — Buy around 11.40, Target 16 in 10 days. SL 9.80. Holding disclosure noted, SEBI Reg No INH100008984.",
      sebi_expected_status: "REGISTERED",
      data_label: "MIXED",
      coverage_note:
        "Micro-cap equity clip with explicit stop-loss and disclosure; synthetic series illustrates low-liquidity, micro-cap, and ASM attention flags.",
    },
    {
      id: "vivek-rana-wipro-limited",
      influencer_id: INFLUENCER_IDS.VIVEK_RANA,
      influencer_name: "Vivek Rana",
      alias: null,
      ticker: "WIPRO",
      instrument_name: "Wipro Limited",
      instrument_type: "EQUITY",
      underlying_ticker: null,
      media_type: "VIDEO",
      media_path: "/media/videos/Vivek_Rana__Wipro_Limited__Not_Registered.App.mp4",
      tip_date: "2026-11-11",
      sample_text:
        "Wipro Limited strong setup! Buy now Target 630 in 20 days. Don't miss out, last chance before rally! Educational purpose only.",
      sebi_expected_status: "NOT_FOUND",
      data_label: "MIXED",
      coverage_note:
        "Large-cap contrast case: liquidity, market cap, volume, and surveillance are within normal range, showing that calm checks still coexist with hype cues & missing stop-loss.",
    },
  ];

  // Curated historical tips for Tip Time Machine markers + creator track record resolution
  const tips: CuratedTipRecord[] = [
    {
      id: "44444444-4444-4444-8444-444444444401",
      influencer_id: INFLUENCER_IDS.RAKESH_BANSAL,
      ticker: "BORORENEW",
      tip_date: "2026-11-10",
      text: demoCases[3]!.sample_text,
      direction: "BULLISH",
      target_price: 740,
      deadline: "2026-11-19",
      stop_loss: null,
      disclosure_grade: "CLEAR",
      source_url: "https://example.org/tip-autopsy-demo/rakesh-bororenew-2026-11-10",
      media_asset_path: demoCases[3]!.media_path,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "MIXED",
    },
    {
      id: "44444444-4444-4444-8444-444444444402",
      influencer_id: INFLUENCER_IDS.RAKESH_BANSAL,
      ticker: "BORORENEW",
      tip_date: "2026-10-15",
      text: "Borosil Renewables Ltd accumulation watch above 530, Target 590 by 2026-11-05. SEBI Reg No INH100008984.",
      direction: "BULLISH",
      target_price: 590,
      deadline: "2026-11-05",
      stop_loss: 505,
      disclosure_grade: "CLEAR",
      source_url: "https://example.org/tip-autopsy-demo/rakesh-bororenew-2026-10-15",
      media_asset_path: null,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "SYNTHETIC",
    },
    {
      id: "44444444-4444-4444-8444-444444444403",
      influencer_id: INFLUENCER_IDS.RAKESH_BANSAL,
      ticker: "SARVESHWAR",
      tip_date: "2026-11-12",
      text: demoCases[4]!.sample_text,
      direction: "BULLISH",
      target_price: 16,
      deadline: "2026-11-19",
      stop_loss: 9.8,
      disclosure_grade: "CLEAR",
      source_url: "https://example.org/tip-autopsy-demo/rakesh-sarveshwar-2026-11-12",
      media_asset_path: demoCases[4]!.media_path,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "MIXED",
    },
    {
      id: "44444444-4444-4444-8444-444444444404",
      influencer_id: INFLUENCER_IDS.VIVEK_RANA,
      ticker: "WIPRO",
      tip_date: "2026-11-11",
      text: demoCases[5]!.sample_text,
      direction: "BULLISH",
      target_price: 630,
      deadline: "2026-11-19",
      stop_loss: null,
      disclosure_grade: "VAGUE",
      source_url: "https://example.org/tip-autopsy-demo/vivek-wipro-2026-11-11",
      media_asset_path: demoCases[5]!.media_path,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "MIXED",
    },
    {
      id: "44444444-4444-4444-8444-444444444405",
      influencer_id: INFLUENCER_IDS.VIVEK_RANA,
      ticker: "WIPRO",
      tip_date: "2026-10-08",
      text: "Wipro Limited breakout soon — Buy 560 Target 600. Educational purpose only.",
      direction: "BULLISH",
      target_price: 600,
      deadline: "2026-10-28",
      stop_loss: null,
      disclosure_grade: "VAGUE",
      source_url: "https://example.org/tip-autopsy-demo/vivek-wipro-2026-10-08",
      media_asset_path: null,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "SYNTHETIC",
    },
    {
      id: "44444444-4444-4444-8444-444444444406",
      influencer_id: INFLUENCER_IDS.ASHISH_KYAL,
      ticker: "SENSEX_82900_CE",
      tip_date: "2026-11-10",
      text: demoCases[0]!.sample_text,
      direction: "BULLISH",
      target_price: 380,
      deadline: null,
      stop_loss: null,
      disclosure_grade: "NONE",
      source_url: "https://example.org/tip-autopsy-demo/ashish-sensex-82900-ce",
      media_asset_path: demoCases[0]!.media_path,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "MIXED",
    },
    {
      id: "44444444-4444-4444-8444-444444444407",
      influencer_id: INFLUENCER_IDS.CHINMAY_DUDHANE,
      ticker: "NIFTY_25500_CE",
      tip_date: "2026-11-11",
      text: demoCases[1]!.sample_text,
      direction: "BULLISH",
      target_price: 190,
      deadline: null,
      stop_loss: null,
      disclosure_grade: "CLEAR",
      source_url: "https://example.org/tip-autopsy-demo/chinmay-nifty-25500-ce",
      media_asset_path: demoCases[1]!.media_path,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "MIXED",
    },
    {
      id: "44444444-4444-4444-8444-444444444408",
      influencer_id: INFLUENCER_IDS.HARSH_BHAGAT,
      ticker: "NIFTY_25600_CE",
      tip_date: "2026-11-12",
      text: demoCases[2]!.sample_text,
      direction: "BULLISH",
      target_price: 210,
      deadline: null,
      stop_loss: null,
      disclosure_grade: "NONE",
      source_url: "https://example.org/tip-autopsy-demo/harsh-nifty-25600-ce",
      media_asset_path: demoCases[2]!.media_path,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "MIXED",
    },
  ];

  // Add 22 synthetic resolved tips for DEMO_HIGH_VOLUME_CREATOR so credible interval UI is verifiable
  for (let idx = 0; idx < 22; idx++) {
    const startIdx = idx + 1;
    const endIdx = Math.min(startIdx + 12, dates.length - 1);
    const tipDate = dates[startIdx]!;
    const deadline = dates[endIdx]!;
    const ticker = idx % 2 === 0 ? "BORORENEW" : "SARVESHWAR";
    tips.push({
      id: `44444444-4444-4444-8444-4444444445${String(idx + 10).padStart(2, "0")}`,
      influencer_id: INFLUENCER_IDS.DEMO_HIGH_VOLUME_CREATOR,
      ticker,
      tip_date: tipDate,
      text: `Synthetic calibration example #${idx + 1} on ${ticker} for credible-interval testing.`,
      direction: "BULLISH",
      target_price: null,
      deadline,
      stop_loss: null,
      disclosure_grade: "NONE",
      source_url: null,
      media_asset_path: null,
      is_synthetic: true,
      snapshot_id: SNAPSHOT_IDS.TIPS,
      data_label: "SYNTHETIC",
    });
  }

  const snapshots: SnapshotRecord[] = [
    {
      id: SNAPSHOT_IDS.SEBI,
      dataset_key: "sebi_register",
      source_name: "Curated SEBI Intermediaries Register Demo Snapshot",
      source_url: "https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes",
      as_of_date: "2026-11-18",
      retrieved_at: "2026-11-18T12:00:00Z",
      data_label: "MIXED",
      version: "sebi-demo-v1",
      checksum: computePayloadChecksum(sebiEntries),
      row_count: sebiEntries.length,
      validation_status: "VALID",
      notes: "Curated demo snapshot reconciling photos/ and videos/ creators; replace with full dated SEBI export for production.",
    },
    {
      id: SNAPSHOT_IDS.PRICES,
      dataset_key: "nse_prices",
      source_name: "Tip Autopsy Synthetic Demo Equity Series",
      source_url: null,
      as_of_date: asOfDate,
      retrieved_at: "2026-11-19T16:30:00Z",
      data_label: "SYNTHETIC",
      version: "prices-demo-v1",
      checksum: computePayloadChecksum(Object.values(pricesByTicker).flat()),
      row_count: Object.values(pricesByTicker).flat().length,
      validation_status: "VALID",
      notes: "Explicitly labelled synthetic demo series for BORORENEW, SARVESHWAR, and WIPRO until verified NSE/BSE Bhavcopy CSVs are imported.",
    },
    {
      id: SNAPSHOT_IDS.BENCHMARKS,
      dataset_key: "benchmark_indices",
      source_name: "Tip Autopsy Synthetic Demo Benchmarks (NIFTY 50, SENSEX, BANKNIFTY)",
      source_url: null,
      as_of_date: asOfDate,
      retrieved_at: "2026-11-19T16:30:00Z",
      data_label: "SYNTHETIC",
      version: "benchmarks-demo-v1",
      checksum: computePayloadChecksum(Object.values(benchmarks).flat()),
      row_count: Object.values(benchmarks).flat().length,
      validation_status: "VALID",
      notes: "Explicitly labelled synthetic demo index closes for NIFTY 50, SENSEX, and BANKNIFTY.",
    },
    {
      id: SNAPSHOT_IDS.STOCK_INFO,
      dataset_key: "market_cap",
      source_name: "Tip Autopsy Synthetic Demo Market-Cap Snapshot",
      source_url: null,
      as_of_date: "2026-11-18",
      retrieved_at: "2026-11-18T12:00:00Z",
      data_label: "SYNTHETIC",
      version: "market-cap-demo-v1",
      checksum: computePayloadChecksum(Object.values(stockInfoByTicker)),
      row_count: Object.keys(stockInfoByTicker).length,
      validation_status: "VALID",
      notes: "Versioned size bands (amfi-size-band-v1) for demo equities; index options intentionally omitted.",
    },
    {
      id: SNAPSHOT_IDS.SURVEILLANCE,
      dataset_key: "surveillance",
      source_name: "Tip Autopsy Synthetic Demo ASM/GSM Snapshot",
      source_url: null,
      as_of_date: "2026-11-18",
      retrieved_at: "2026-11-18T12:00:00Z",
      data_label: "SYNTHETIC",
      version: "surveillance-demo-v1",
      checksum: computePayloadChecksum(Object.values(surveillanceByTicker).flat()),
      row_count: Object.values(surveillanceByTicker).flat().length,
      validation_status: "VALID",
      notes: "Explicitly labelled synthetic demo ASM/GSM surveillance rows.",
    },
    {
      id: SNAPSHOT_IDS.TIPS,
      dataset_key: "curated_tip_corpus",
      source_name: "Curated Hinglish Media Corpus (photos/ & videos/) + Synthetic Examples",
      source_url: null,
      as_of_date: asOfDate,
      retrieved_at: "2026-11-19T16:30:00Z",
      data_label: "MIXED",
      version: "curated-tips-demo-v1",
      checksum: computePayloadChecksum(tips),
      row_count: tips.length,
      validation_status: "VALID",
      notes: "Every row carries explicit is_synthetic=true and provenance badges.",
    },
  ];

  return {
    snapshots,
    influencers,
    sebiEntries,
    stocks,
    pricesByTicker,
    stockInfoByTicker,
    surveillanceByTicker,
    benchmarks,
    tips,
    demoCases,
  };
}

export const DEMO_DATASET: DemoDataset = buildDemoDataset();
