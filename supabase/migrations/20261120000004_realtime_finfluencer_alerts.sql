-- Tip Autopsy — Phase 4 Real-Time YouTube Monitoring & Opt-In WhatsApp Alert Subscriptions (Task 4.2)
-- Privacy guardrail: Narrow opt-in persistence ONLY for WhatsApp alert subscriptions (AES-256-GCM encrypted + masked).
-- Still ZERO end-user logins, accounts, portfolios, uploaded tip media, pasted tips, or Pause & Plan persistence.
-- Security guardrail: RLS enabled with explicit deny-public policies on every new table in public schema.

ALTER TABLE public.influencer
  ADD COLUMN IF NOT EXISTS youtube_channel_id text,
  ADD COLUMN IF NOT EXISTS youtube_handle text,
  ADD COLUMN IF NOT EXISTS youtube_channel_url text,
  ADD COLUMN IF NOT EXISTS avatar_initials text,
  ADD COLUMN IF NOT EXISTS bio_summary text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_youtube_channel_id
  ON public.influencer (youtube_channel_id)
  WHERE youtube_channel_id IS NOT NULL;

-- Update existing seeded creators with verified public YouTube metadata
UPDATE public.influencer
SET
  youtube_channel_id = 'UC6HlGuJZ0_M_rSgm0hoRhDQ',
  youtube_handle = '@iamrakeshbansal',
  youtube_channel_url = 'https://www.youtube.com/channel/UC6HlGuJZ0_M_rSgm0hoRhDQ',
  avatar_initials = 'RB',
  bio_summary = 'SEBI-registered Research Analyst in curated snapshot; publishes Hindi/Hinglish equity & chart breakdowns on YouTube.'
WHERE id = '22222222-2222-4222-8222-222222222204';

UPDATE public.influencer
SET
  youtube_handle = '@kyalashish',
  youtube_channel_url = 'https://www.youtube.com/@kyalashish',
  avatar_initials = 'AK',
  bio_summary = 'Technical analysis and index derivatives commentary (Waves Strategy).'
WHERE id = '22222222-2222-4222-8222-222222222201';

UPDATE public.influencer
SET
  youtube_handle = '@tradingcafeindia',
  youtube_channel_url = 'https://www.youtube.com/@tradingcafeindia',
  avatar_initials = 'CD',
  bio_summary = 'Founder of Trading Cafe India; options and market structure content.'
WHERE id = '22222222-2222-4222-8222-222222222202';

UPDATE public.influencer
SET
  avatar_initials = 'HB',
  bio_summary = 'Index options trading commentary.'
WHERE id = '22222222-2222-4222-8222-222222222203';

UPDATE public.influencer
SET
  avatar_initials = 'VR',
  bio_summary = 'Short-form equity commentary clips.'
WHERE id = '22222222-2222-4222-8222-222222222205';

UPDATE public.influencer
SET
  avatar_initials = 'AF',
  bio_summary = 'Synthetic demo creator seeded exclusively for Beta-Binomial track-record evaluation.'
WHERE id = '22222222-2222-4222-8222-222222222206';

-- Seed additional popular Indian YouTube finfluencers with verified public YouTube Atom RSS channel IDs
INSERT INTO public.influencer (
  id, name, handle, aliases, normalized_name, sebi_registration_no,
  youtube_channel_id, youtube_handle, youtube_channel_url, avatar_initials, bio_summary
) VALUES
  (
    '22222222-2222-4222-8222-222222222207',
    'CA Rachana Ranade',
    '@CARachanaRanade',
    ARRAY['Rachana Ranade', 'CA Rachana Phadke Ranade'],
    'ca rachana ranade',
    NULL,
    'UCe3qdG0A_gr-sEdat5y2twQ',
    '@CARachanaRanade',
    'https://www.youtube.com/channel/UCe3qdG0A_gr-sEdat5y2twQ',
    'RR',
    'Indian retail finance educator covering IPOs, stock fundamentals, and personal finance on YouTube.'
  ),
  (
    '22222222-2222-4222-8222-222222222208',
    'Pranjal Kamra',
    '@pranjalkamra',
    ARRAY['Finology', 'Finology Ventures'],
    'pranjal kamra',
    NULL,
    'UCwAdQUuPT6laN-AQR17fe1g',
    '@pranjalkamra',
    'https://www.youtube.com/channel/UCwAdQUuPT6laN-AQR17fe1g',
    'PK',
    'Indian equity investing and mutual fund educator publishing market explainers on YouTube.'
  )
ON CONFLICT (id) DO UPDATE SET
  youtube_channel_id = EXCLUDED.youtube_channel_id,
  youtube_handle = EXCLUDED.youtube_handle,
  youtube_channel_url = EXCLUDED.youtube_channel_url,
  avatar_initials = EXCLUDED.avatar_initials,
  bio_summary = EXCLUDED.bio_summary;

-- 1. Analyzed real-time YouTube videos (official Atom RSS / WebSub)
CREATE TABLE IF NOT EXISTS public.youtube_video_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencer(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  title text NOT NULL,
  video_url text NOT NULL,
  thumbnail_url text,
  published_at timestamptz NOT NULL,
  transcript_source text NOT NULL CHECK (transcript_source IN ('CAPTIONS', 'METADATA_ONLY')),
  detected_ticker text,
  claim_ledger_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  hype_flags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  disclosure_grade public.disclosure_grade_enum NOT NULL DEFAULT 'UNKNOWN',
  guarded_report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  guard_status text NOT NULL CHECK (guard_status IN ('PASSED', 'BLOCKED_FALLBACK')),
  whatsapp_summary_text text NOT NULL,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_video_analysis_unique_video_id UNIQUE (video_id)
);

-- 2. Opt-in WhatsApp alert subscriptions (AES-256-GCM encrypted phone/key, masked display, one-click unsubscribe)
CREATE TABLE IF NOT EXISTS public.finfluencer_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencer(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  phone_masked text NOT NULL,
  phone_encrypted text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('callmebot', 'meta_cloud', 'dry_run')),
  provider_config_encrypted text,
  is_active boolean NOT NULL DEFAULT true,
  consent_given_at timestamptz NOT NULL DEFAULT now(),
  unsubscribe_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finfluencer_subscription_unique_influencer_phone UNIQUE (influencer_id, phone_hash),
  CONSTRAINT finfluencer_subscription_unique_unsub_token UNIQUE (unsubscribe_token)
);

-- 3. Idempotent WhatsApp alert delivery audit log (never stores plaintext phone numbers)
CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.finfluencer_subscription(id) ON DELETE CASCADE,
  video_analysis_id uuid NOT NULL REFERENCES public.youtube_video_analysis(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('callmebot', 'meta_cloud', 'dry_run')),
  delivery_status text NOT NULL CHECK (delivery_status IN ('SENT', 'DRY_RUN_PREVIEW', 'FAILED', 'BLOCKED_BY_GUARD')),
  message_preview text NOT NULL,
  error_code text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_delivery_log_unique_sub_video UNIQUE (subscription_id, video_analysis_id)
);

-- Performance & FK indexes
CREATE INDEX IF NOT EXISTS idx_youtube_video_analysis_influencer_published
  ON public.youtube_video_analysis (influencer_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_finfluencer_subscription_influencer_active
  ON public.finfluencer_subscription (influencer_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_delivery_log_subscription
  ON public.whatsapp_delivery_log (subscription_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_delivery_log_video
  ON public.whatsapp_delivery_log (video_analysis_id);

-- Enforce strict RLS deny-public policies on all Phase 4 tables
DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'youtube_video_analysis',
    'finfluencer_subscription',
    'whatsapp_delivery_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    pol := 'deny_public_access_' || tbl;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = pol
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        pol,
        tbl
      );
    END IF;
  END LOOP;
END
$$;
