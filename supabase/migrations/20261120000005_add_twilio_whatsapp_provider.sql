-- Tip Autopsy — Add Twilio WhatsApp automation provider to Phase 4 subscription & delivery constraints
ALTER TABLE public.finfluencer_subscription
  DROP CONSTRAINT IF EXISTS finfluencer_subscription_provider_check;

ALTER TABLE public.finfluencer_subscription
  ADD CONSTRAINT finfluencer_subscription_provider_check
  CHECK (provider IN ('twilio', 'callmebot', 'meta_cloud', 'dry_run'));

ALTER TABLE public.whatsapp_delivery_log
  DROP CONSTRAINT IF EXISTS whatsapp_delivery_log_provider_check;

ALTER TABLE public.whatsapp_delivery_log
  ADD CONSTRAINT whatsapp_delivery_log_provider_check
  CHECK (provider IN ('twilio', 'callmebot', 'meta_cloud', 'dry_run'));
