export type DataLabel = "REAL" | "SYNTHETIC" | "MIXED";
export type InstrumentType = "EQUITY" | "DERIVATIVE";
export type DisclosureGrade = "CLEAR" | "VAGUE" | "NONE" | "UNKNOWN";
export type TipDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type CheckStatus = "WITHIN_NORMAL_RANGE" | "NEEDS_ATTENTION" | "COULD_NOT_VERIFY";
export type SebiLookupStatus = "REGISTERED" | "NOT_FOUND" | "UNCLEAR";

export interface SourceSpan {
  start: number;
  end: number;
  text: string;
}

export interface ClaimField<T = string | number | null> {
  value: T;
  status: "EXTRACTED" | "NOT_STATED" | "UNCLEAR";
  gated?: boolean;
  note?: string;
  evidence: SourceSpan | null;
}

export interface ClaimLedger {
  stock: ClaimField<string | null>;
  direction: ClaimField<TipDirection | null>;
  target_price: ClaimField<number | null>;
  deadline: ClaimField<string | null>;
  stop_loss: ClaimField<number | null>;
}

export interface HypeFlag {
  phrase: string;
  start: number;
  end: number;
  rule_id: string;
  category: "CERTAINTY" | "URGENCY" | "PROMOTIONAL" | "RETURN_PROMISE";
}

export interface DisclosureGradeResult {
  grade: DisclosureGrade;
  evidence: SourceSpan[];
  method_version: string;
  plain_ad_baseline_matched: boolean;
  explanation: string;
}

export interface ParseResponse {
  request_id: string;
  schema_version: string;
  extracted_text: string;
  media_intake: {
    received: boolean;
    kind: "PHOTO" | "VIDEO" | null;
    detected_mime: string | null;
    byte_length: number;
    persisted: false;
    extraction_mode: "TEXT_ONLY" | "CURATED_DEMO_TRANSCRIPT" | "PROVIDER_UNAVAILABLE_FALLBACK";
    notice: string | null;
  };
  claims: ClaimLedger;
  hype_flags: HypeFlag[];
  hype_dictionary_version: string;
  disclosure_grade: DisclosureGradeResult;
  parser: {
    status: "COMPLETED" | "FALLBACK_STRUCTURED_ONLY";
    version: string;
    note: string | null;
  };
}

export interface SebiLookupResponse {
  request_id: string;
  influencer_id: string | null;
  query: string;
  status: SebiLookupStatus;
  matched_name: string | null;
  registration_no: string | null;
  category: string | null;
  snapshot_id: string | null;
  snapshot_date: string | null;
  data_label: DataLabel | null;
  explanation: string;
  candidates_considered: number;
}

export interface StockLookupItem {
  ticker: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  instrument_type: InstrumentType;
  underlying_ticker: string | null;
  has_price_history: boolean;
  latest_price_date: string | null;
}

export interface PricesResponse {
  request_id: string;
  ticker: string;
  company_name: string;
  instrument_type: InstrumentType;
  series_scope: "SECURITY" | "UNDERLYING_INDEX";
  underlying_ticker: string | null;
  as_of_date: string | null;
  source_snapshot_id: string | null;
  source_name: string | null;
  data_label: DataLabel | null;
  series: Array<{
    trading_date: string;
    close: number;
    volume: number | null;
  }>;
}

export interface TipMarkerItem {
  tip_date: string;
  count: number;
  has_synthetic: boolean;
  data_label: DataLabel;
}

export interface ExactDateTip {
  id: string;
  influencer_id: string;
  ticker: string;
  tip_date: string;
  text: string;
  direction: TipDirection | null;
  target_price: number | null;
  deadline: string | null;
  stop_loss: number | null;
  disclosure_grade: DisclosureGrade;
  source_url: string | null;
  is_synthetic: boolean;
  data_label: DataLabel;
  snapshot_id: string;
}

export interface MarketCheckResult {
  check_id: "liquidity" | "market_cap" | "volume_spike" | "pre_tip_run_up" | "surveillance";
  label: string;
  status: CheckStatus;
  measured_value: number | string | null;
  unit: string | null;
  as_of_date: string | null;
  source_snapshot_id: string | null;
  source_name: string | null;
  data_label: DataLabel | null;
  method_version: string;
  explanation_key: string;
  explanation: string;
  reason_code: string | null;
  details?: Record<string, string | number | boolean | null>;
}

export interface TrackRecordResult {
  status: "INTERVAL_AVAILABLE" | "NOT_ENOUGH_TIPS_TO_JUDGE";
  creator_id: string | null;
  creator_name: string | null;
  resolved_count: number;
  success_count: number;
  failure_count: number;
  excluded_count: number;
  minimum_sample_policy: number;
  credible_interval_level: number;
  credible_interval: {
    lower: number;
    upper: number;
    posterior_mean: number;
  } | null;
  matched_baseline: number;
  clears_baseline: boolean;
  prior: { alpha: number; beta: number };
  benchmark: string;
  as_of_date: string | null;
  data_label: DataLabel | null;
  method_version: string;
  explanation: string;
}

export interface ChecksResponse {
  request_id: string;
  ticker: string;
  company_name: string;
  instrument_type: InstrumentType;
  underlying_ticker: string | null;
  as_of_date: string;
  tip_date: string;
  methodology_version: string;
  checks: MarketCheckResult[];
  track_record: TrackRecordResult;
}

export interface GuardedReportResponse {
  request_id: string;
  report_version: string;
  guard_status: "PASSED" | "BLOCKED_FALLBACK";
  guard_blocked_reason: string | null;
  information_verdict_title: string;
  sections: Array<{
    section_id: string;
    title: string;
    template_id: string;
    sentence: string;
    source_snapshot_id: string | null;
    as_of_date: string | null;
    data_label: DataLabel | null;
  }>;
  creator_quoted_claim: {
    label: "Creator's claim";
    quoted_text: string | null;
    target_price_claimed: number | null;
    disclaimer: string;
  };
  provenance_summary: {
    snapshot_ids: string[];
    as_of_dates: string[];
    data_labels: DataLabel[];
  };
  mandatory_disclaimer: string;
}

export interface BenchmarkSummary {
  key: "NIFTY_50" | "SENSEX" | "BANKNIFTY";
  label: string;
  status: "AVAILABLE" | "COULD_NOT_VERIFY";
  close: number | null;
  change: number | null;
  change_percent: number | null;
  as_of_date: string | null;
  fetched_at?: string | null;
  data_freshness?: "LIVE_FEED" | "DATED_SNAPSHOT" | null;
  data_label: DataLabel | null;
  source_name: string | null;
  sparkline: Array<{ date: string; close: number }>;
}

export interface LiveStockQuote {
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: "NSE" | "BSE";
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
  size_band: "LARGE" | "MID" | "SMALL" | "MICRO" | null;
  as_of_date: string;
  fetched_at: string;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT";
  data_label: "REAL" | "SYNTHETIC";
  source_name: string;
  delay_note: string;
  sparkline: Array<{ date: string; close: number }>;
}

export interface LiveQuotesResponse {
  request_id: string;
  fetched_at: string;
  feed_status: "LIVE_FEED" | "SNAPSHOT_FALLBACK" | "COULD_NOT_VERIFY";
  benchmarks: BenchmarkSummary[];
  quotes: LiveStockQuote[];
}

export interface LiveStockSearchItem {
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  instrument_type: InstrumentType;
  sector: string | null;
  source: "LIVE_SEARCH" | "CATALOGUE" | "WATCHLIST";
}

export interface LiveStockDetailResponse {
  request_id: string;
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

export type WhatsAppProviderKind = "twilio" | "callmebot" | "meta_cloud" | "dry_run";

export interface VideoAnalysisItem {
  id: string;
  influencer_id: string;
  video_id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  published_at: string;
  transcript_source: "CAPTIONS" | "METADATA_ONLY";
  detected_ticker: string | null;
  claim_ledger_json: ClaimLedger;
  hype_flags_json: HypeFlag[];
  disclosure_grade: DisclosureGrade;
  guarded_report_json: GuardedReportResponse;
  guard_status: "PASSED" | "BLOCKED_FALLBACK";
  whatsapp_summary_text: string;
  analyzed_at: string;
}

export interface FinfluencerDirectoryItem {
  id: string;
  name: string;
  handle: string | null;
  aliases: string[];
  avatar_initials: string;
  bio_summary: string | null;
  youtube_channel_id: string | null;
  youtube_handle: string | null;
  youtube_channel_url: string | null;
  has_realtime_youtube_feed: boolean;
  sebi_status: SebiLookupStatus;
  sebi_registration_no: string | null;
  sebi_category: string | null;
  sebi_snapshot_date: string | null;
  sebi_explanation: string;
  active_subscriber_count: number;
  latest_videos: VideoAnalysisItem[];
}

export interface FinfluencersResponse {
  request_id: string;
  fetched_at: string;
  twilio_whatsapp_configured?: boolean;
  whatsapp_meta_configured: boolean;
  llm_provider: string;
  items: FinfluencerDirectoryItem[];
}

export interface SubscriptionSummary {
  id: string;
  influencer_id: string;
  influencer_name: string;
  phone_masked: string;
  provider: WhatsAppProviderKind;
  is_active: boolean;
  consent_given_at: string;
  unsubscribe_token: string;
}

export interface SubscribeResponse {
  request_id: string;
  subscription: SubscriptionSummary;
  message: string;
}

export interface TestAlertResponse {
  request_id: string;
  video_id: string;
  video_title: string;
  delivery_status: "SENT" | "DRY_RUN_PREVIEW" | "FAILED" | "BLOCKED_BY_GUARD";
  provider: WhatsAppProviderKind;
  phone_masked: string;
  message_preview: string;
  wa_me_url: string | null;
  error_code: string | null;
}

export interface SyncFinfluencerResponse {
  request_id: string;
  influencer_id: string;
  influencer_name: string;
  fetched_from_rss: number;
  newly_analyzed: number;
  alerts_dispatched: number;
  videos: VideoAnalysisItem[];
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

export type SupportedVoiceLanguage = "en-IN" | "hi-IN" | "kn-IN";

export interface VoiceReadoutResponse {
  request_id: string;
  status: "READY" | "DISABLED" | "UNAVAILABLE";
  language: SupportedVoiceLanguage;
  audio_base64: string | null;
  mime_type: string | null;
  guard_verified: true;
  message: string;
}

export interface CoordinatedDemoSignalResponse {
  request_id: string;
  feature_scope: "OPTIONAL_SYNTHETIC_DEMO_ONLY";
  is_synthetic: true;
  data_label: "SYNTHETIC";
  ticker: string;
  window_minutes: number;
  distinct_channels_in_window: number;
  median_phrase_overlap: number;
  status: "BURST_CLUSTER_OBSERVED_DEMO" | "NO_SYNTHETIC_CLUSTER_FOR_TICKER";
  events: Array<{
    channel_label: string;
    posted_at_iso: string;
    ticker: string;
    phrase_overlap_jaccard: number;
    is_synthetic: true;
  }>;
  what_this_shows: string;
  limitations: string[];
}
