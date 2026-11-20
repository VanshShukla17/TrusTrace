import { randomUUID } from "node:crypto";
import type { AppEnv } from "../core/env.js";
import type {
  ClaimLedger,
  DisclosureGrade,
  GuardedReportResponse,
  HypeFlag,
} from "../domain/types.js";
import type { WhatsAppProviderKind } from "../integrations/whatsappNotifier.js";
import { getSupabaseAdminClient } from "./supabase.js";

export interface VideoAnalysisRecord {
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

export interface SubscriptionRecord {
  id: string;
  influencer_id: string;
  phone_hash: string;
  phone_masked: string;
  phone_encrypted: string;
  provider: WhatsAppProviderKind;
  provider_config_encrypted: string | null;
  is_active: boolean;
  consent_given_at: string;
  unsubscribe_token: string;
  created_at: string;
}

export interface DeliveryLogRecord {
  id: string;
  subscription_id: string;
  video_analysis_id: string;
  provider: WhatsAppProviderKind;
  delivery_status: "SENT" | "DRY_RUN_PREVIEW" | "FAILED" | "BLOCKED_BY_GUARD";
  message_preview: string;
  error_code: string | null;
  sent_at: string;
}

export interface FinfluencerAlertRepository {
  listVideoAnalyses(influencerId: string, limit?: number): Promise<VideoAnalysisRecord[]>;
  getVideoAnalysisByVideoId(videoId: string): Promise<VideoAnalysisRecord | null>;
  saveVideoAnalysis(
    record: Omit<VideoAnalysisRecord, "id" | "analyzed_at">
  ): Promise<VideoAnalysisRecord>;
  countActiveSubscribers(influencerId: string): Promise<number>;
  listActiveSubscriptions(influencerId: string): Promise<SubscriptionRecord[]>;
  findSubscriptionById(id: string): Promise<SubscriptionRecord | null>;
  upsertSubscription(
    record: Omit<SubscriptionRecord, "id" | "created_at" | "consent_given_at">
  ): Promise<SubscriptionRecord>;
  unsubscribeByToken(token: string): Promise<{ unsubscribed: boolean; phone_masked: string | null }>;
  hasDeliveryLog(subscriptionId: string, videoAnalysisId: string): Promise<boolean>;
  recordDeliveryLog(
    record: Omit<DeliveryLogRecord, "id" | "sent_at">
  ): Promise<DeliveryLogRecord>;
}

/**
 * Supabase-backed repository for Phase 4 YouTube analyses and opt-in encrypted WhatsApp
 * alert subscriptions, with clean in-memory fallback for unconfigured local dev/tests.
 */
export function createFinfluencerAlertRepository(config: AppEnv): FinfluencerAlertRepository {
  const supabase = getSupabaseAdminClient(config);

  // In-memory store fallback when Supabase service-role is unavailable (e.g. unit/Supertest runs)
  const memVideos = new Map<string, VideoAnalysisRecord>(); // keyed by video_id
  const memSubs = new Map<string, SubscriptionRecord>(); // keyed by id
  const memLogs = new Map<string, DeliveryLogRecord>(); // keyed by `${subId}:${videoAnalysisId}`

  return {
    async listVideoAnalyses(influencerId: string, limit = 8): Promise<VideoAnalysisRecord[]> {
      if (supabase) {
        const { data, error } = await supabase
          .from("youtube_video_analysis")
          .select("*")
          .eq("influencer_id", influencerId)
          .order("published_at", { ascending: false })
          .limit(limit);
        if (!error && data) {
          return data as unknown as VideoAnalysisRecord[];
        }
      }
      return [...memVideos.values()]
        .filter((v) => v.influencer_id === influencerId)
        .sort((a, b) => b.published_at.localeCompare(a.published_at))
        .slice(0, limit);
    },

    async getVideoAnalysisByVideoId(videoId: string): Promise<VideoAnalysisRecord | null> {
      if (supabase) {
        const { data, error } = await supabase
          .from("youtube_video_analysis")
          .select("*")
          .eq("video_id", videoId)
          .maybeSingle();
        if (!error && data) {
          return data as unknown as VideoAnalysisRecord;
        }
      }
      return memVideos.get(videoId) ?? null;
    },

    async saveVideoAnalysis(
      record: Omit<VideoAnalysisRecord, "id" | "analyzed_at">
    ): Promise<VideoAnalysisRecord> {
      if (supabase) {
        const { data, error } = await supabase
          .from("youtube_video_analysis")
          .upsert(
            {
              influencer_id: record.influencer_id,
              video_id: record.video_id,
              title: record.title,
              video_url: record.video_url,
              thumbnail_url: record.thumbnail_url,
              published_at: record.published_at,
              transcript_source: record.transcript_source,
              detected_ticker: record.detected_ticker,
              claim_ledger_json: record.claim_ledger_json,
              hype_flags_json: record.hype_flags_json,
              disclosure_grade: record.disclosure_grade,
              guarded_report_json: record.guarded_report_json,
              guard_status: record.guard_status,
              whatsapp_summary_text: record.whatsapp_summary_text,
            },
            { onConflict: "video_id" }
          )
          .select("*")
          .single();
        if (!error && data) {
          return data as unknown as VideoAnalysisRecord;
        }
      }

      const existing = memVideos.get(record.video_id);
      const stored: VideoAnalysisRecord = {
        ...record,
        id: existing?.id ?? randomUUID(),
        analyzed_at: new Date().toISOString(),
      };
      memVideos.set(record.video_id, stored);
      return stored;
    },

    async countActiveSubscribers(influencerId: string): Promise<number> {
      if (supabase) {
        const { count, error } = await supabase
          .from("finfluencer_subscription")
          .select("id", { count: "exact", head: true })
          .eq("influencer_id", influencerId)
          .eq("is_active", true);
        if (!error && typeof count === "number") {
          return count;
        }
      }
      return [...memSubs.values()].filter(
        (s) => s.influencer_id === influencerId && s.is_active
      ).length;
    },

    async listActiveSubscriptions(influencerId: string): Promise<SubscriptionRecord[]> {
      if (supabase) {
        const { data, error } = await supabase
          .from("finfluencer_subscription")
          .select("*")
          .eq("influencer_id", influencerId)
          .eq("is_active", true);
        if (!error && data) {
          return data as unknown as SubscriptionRecord[];
        }
      }
      return [...memSubs.values()].filter(
        (s) => s.influencer_id === influencerId && s.is_active
      );
    },

    async findSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
      if (supabase) {
        const { data, error } = await supabase
          .from("finfluencer_subscription")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (!error && data) {
          return data as unknown as SubscriptionRecord;
        }
      }
      return memSubs.get(id) ?? null;
    },

    async upsertSubscription(
      record: Omit<SubscriptionRecord, "id" | "created_at" | "consent_given_at">
    ): Promise<SubscriptionRecord> {
      const now = new Date().toISOString();
      if (supabase) {
        const { data, error } = await supabase
          .from("finfluencer_subscription")
          .upsert(
            {
              influencer_id: record.influencer_id,
              phone_hash: record.phone_hash,
              phone_masked: record.phone_masked,
              phone_encrypted: record.phone_encrypted,
              provider: record.provider,
              provider_config_encrypted: record.provider_config_encrypted,
              is_active: true,
              consent_given_at: now,
              unsubscribe_token: record.unsubscribe_token,
            },
            { onConflict: "influencer_id,phone_hash" }
          )
          .select("*")
          .single();
        if (!error && data) {
          return data as unknown as SubscriptionRecord;
        }
      }

      const existing = [...memSubs.values()].find(
        (s) => s.influencer_id === record.influencer_id && s.phone_hash === record.phone_hash
      );
      const stored: SubscriptionRecord = {
        ...record,
        id: existing?.id ?? randomUUID(),
        is_active: true,
        consent_given_at: now,
        created_at: existing?.created_at ?? now,
      };
      memSubs.set(stored.id, stored);
      return stored;
    },

    async unsubscribeByToken(
      token: string
    ): Promise<{ unsubscribed: boolean; phone_masked: string | null }> {
      if (supabase) {
        const { data, error } = await supabase
          .from("finfluencer_subscription")
          .update({ is_active: false })
          .eq("unsubscribe_token", token)
          .select("phone_masked")
          .maybeSingle();
        if (!error && data) {
          return {
            unsubscribed: true,
            phone_masked: (data as { phone_masked?: string }).phone_masked ?? null,
          };
        }
      }

      const found = [...memSubs.values()].find((s) => s.unsubscribe_token === token);
      if (!found) return { unsubscribed: false, phone_masked: null };
      found.is_active = false;
      memSubs.set(found.id, found);
      return { unsubscribed: true, phone_masked: found.phone_masked };
    },

    async hasDeliveryLog(subscriptionId: string, videoAnalysisId: string): Promise<boolean> {
      if (supabase) {
        const { data, error } = await supabase
          .from("whatsapp_delivery_log")
          .select("id")
          .eq("subscription_id", subscriptionId)
          .eq("video_analysis_id", videoAnalysisId)
          .maybeSingle();
        if (!error && data) return true;
      }
      return memLogs.has(`${subscriptionId}:${videoAnalysisId}`);
    },

    async recordDeliveryLog(
      record: Omit<DeliveryLogRecord, "id" | "sent_at">
    ): Promise<DeliveryLogRecord> {
      const now = new Date().toISOString();
      if (supabase) {
        const { data, error } = await supabase
          .from("whatsapp_delivery_log")
          .upsert(
            {
              subscription_id: record.subscription_id,
              video_analysis_id: record.video_analysis_id,
              provider: record.provider,
              delivery_status: record.delivery_status,
              message_preview: record.message_preview,
              error_code: record.error_code,
            },
            { onConflict: "subscription_id,video_analysis_id" }
          )
          .select("*")
          .single();
        if (!error && data) {
          return data as unknown as DeliveryLogRecord;
        }
      }
      const stored: DeliveryLogRecord = {
        ...record,
        id: randomUUID(),
        sent_at: now,
      };
      memLogs.set(`${record.subscription_id}:${record.video_analysis_id}`, stored);
      return stored;
    },
  };
}
