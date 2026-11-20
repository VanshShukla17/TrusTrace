import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";
import {
  MANDATORY_DISCLAIMER,
  scanSystemAuthoredText,
} from "../domain/output-guard/guard.js";
import type { GuardedReportResponse, SebiLookupResult } from "../domain/types.js";
import { logWarn } from "../core/logger.js";

const WHATSAPP_TIMEOUT_MS = 8_000;

export type WhatsAppProviderKind = "twilio" | "callmebot" | "meta_cloud" | "dry_run";

export interface WhatsAppDeliveryResult {
  status: "SENT" | "DRY_RUN_PREVIEW" | "FAILED" | "BLOCKED_BY_GUARD";
  provider: WhatsAppProviderKind;
  messagePreview: string;
  waMeUrl: string | null;
  errorCode: string | null;
}

const SAFE_WHATSAPP_FALLBACK =
  "Tip Autopsy Evidence Alert: A new video analysis summary did not pass the non-advisory Output Guard and was withheld. Inspect the dated evidence checks in Tip Autopsy directly.\n\n" +
  MANDATORY_DISCLAIMER;

function deriveAesKey(secret?: string): Buffer {
  const effectiveSecret =
    secret && secret.trim().length >= 16
      ? secret.trim()
      : "tip-autopsy-dev-only-ephemeral-key-do-not-use-in-prod";
  return scryptSync(effectiveSecret, "tip-autopsy-sub-salt-v1", 32);
}

export function normalizeE164Phone(rawPhone: string): string | null {
  const digits = rawPhone.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+")
    ? `+${digits.slice(1).replace(/\D/g, "")}`
    : digits.length === 10
      ? `+91${digits}`
      : `+${digits.replace(/\D/g, "")}`;

  if (!/^\+\d{10,15}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function maskPhoneNumber(e164: string): string {
  if (e164.length <= 6) return "***";
  const prefix = e164.slice(0, 3);
  const suffix = e164.slice(-4);
  return `${prefix}${"*".repeat(Math.max(4, e164.length - 7))}${suffix}`;
}

export function hashPhoneForDedupe(e164: string, secret?: string): string {
  const key = deriveAesKey(secret);
  return createHmac("sha256", key).update(e164).digest("hex");
}

export function encryptSensitiveField(plaintext: string, secret?: string): string {
  const key = deriveAesKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSensitiveField(ciphertext: string, secret?: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const key = deriveAesKey(secret);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Builds a concise, template-only, Output-Guarded WhatsApp evidence alert from verified facts.
 * Every system-authored line passes scanSystemAuthoredText() and appends MANDATORY_DISCLAIMER verbatim.
 */
export function buildGuardedWhatsAppSummary(params: {
  influencerName: string;
  videoTitle: string;
  videoUrl: string;
  publishedAtIso: string;
  transcriptSource: "CAPTIONS" | "METADATA_ONLY";
  detectedTicker: string | null;
  sebi: SebiLookupResult;
  report: GuardedReportResponse;
  injectedUnsafeLine?: string;
}): {
  text: string;
  guardStatus: "PASSED" | "BLOCKED_FALLBACK";
  blockedReason: string | null;
} {
  const sebiLabel =
    params.sebi.status === "REGISTERED" && params.sebi.registration_no
      ? `Registered (${params.sebi.registration_no}, snapshot ${params.sebi.snapshot_date ?? "dated"})`
      : params.sebi.status === "NOT_FOUND"
        ? `Not found in SEBI snapshot (${params.sebi.snapshot_date ?? "dated"}; does not establish wrongdoing)`
        : "Unclear in SEBI snapshot";

  const publishedDate = params.publishedAtIso.slice(0, 10);
  const transcriptLabel =
    params.transcriptSource === "CAPTIONS"
      ? "Public captions analyzed"
      : "Title & description only (captions unavailable)";

  const systemLines: string[] = [
    `Tip Autopsy · Real-Time YouTube Evidence Alert`,
    `Creator: ${params.influencerName}`,
    `Published: ${publishedDate} · Source: Official YouTube RSS (${transcriptLabel})`,
    `SEBI Snapshot: ${sebiLabel}`,
    `Instrument Detected: ${params.detectedTicker ?? "Not stated"}`,
  ];

  // Include concise guarded template sentences (already verified by Output Guard)
  for (const section of params.report.sections.slice(0, 3)) {
    systemLines.push(`${section.title}: ${section.sentence}`);
  }

  if (params.injectedUnsafeLine) {
    systemLines.push(params.injectedUnsafeLine);
  }

  // Mandatory Output Guard scan on every system-authored line before dispatch
  for (const line of systemLines) {
    const check = scanSystemAuthoredText(line);
    if (!check.passed) {
      return {
        text: SAFE_WHATSAPP_FALLBACK,
        guardStatus: "BLOCKED_FALLBACK",
        blockedReason: check.blockedReason ?? "WHATSAPP_GUARD_BLOCKED",
      };
    }
  }

  // Video title is visibly isolated as the creator's original title, never system-authored advice
  const fullMessage = [
    ...systemLines,
    `Creator Video Title (Quoted): "${params.videoTitle.replace(/\s+/g, " ").slice(0, 120)}"`,
    `Watch: ${params.videoUrl}`,
    "",
    MANDATORY_DISCLAIMER,
  ].join("\n");

  return {
    text: fullMessage,
    guardStatus: params.report.guard_status,
    blockedReason: params.report.guard_blocked_reason,
  };
}

/**
 * Sends a strictly Output-Guarded WhatsApp alert via zero-cost CallMeBot,
 * official Meta WhatsApp Cloud API, or Dry-Run preview mode.
 * Refuses to dispatch if the final payload lacks MANDATORY_DISCLAIMER or fails Output Guard.
 */
export async function sendGuardedWhatsAppAlert(params: {
  phoneE164: string;
  provider: WhatsAppProviderKind;
  message: string;
  callMeBotApiKey?: string | null;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioWhatsAppFrom?: string;
  metaAccessToken?: string;
  metaPhoneNumberId?: string;
  fetchImpl?: typeof fetch;
}): Promise<WhatsAppDeliveryResult> {
  const fetchImpl = params.fetchImpl ?? fetch;

  // Hard final safety gate on every non-quoted line + verbatim disclaimer presence
  const nonQuotedLines = params.message
    .split("\n")
    .filter((line) => !line.startsWith("Creator Video Title (Quoted):"));
  for (const line of nonQuotedLines) {
    const scan = scanSystemAuthoredText(line);
    if (!scan.passed) {
      return {
        status: "BLOCKED_BY_GUARD",
        provider: params.provider,
        messagePreview: SAFE_WHATSAPP_FALLBACK,
        waMeUrl: null,
        errorCode: scan.blockedReason ?? "OUTPUT_GUARD_BLOCKED",
      };
    }
  }
  if (!params.message.includes(MANDATORY_DISCLAIMER)) {
    return {
      status: "BLOCKED_BY_GUARD",
      provider: params.provider,
      messagePreview: SAFE_WHATSAPP_FALLBACK,
      waMeUrl: null,
      errorCode: "MISSING_MANDATORY_DISCLAIMER",
    };
  }

  const cleanDigits = params.phoneE164.replace(/\D/g, "");
  const waMeUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(params.message)}`;

  if (params.provider === "dry_run") {
    return {
      status: "DRY_RUN_PREVIEW",
      provider: "dry_run",
      messagePreview: params.message,
      waMeUrl,
      errorCode: null,
    };
  }

  // Twilio Programmable Messaging (WhatsApp Sandbox or Production WhatsApp Sender)
  if (params.provider === "twilio") {
    if (!params.twilioAccountSid || !params.twilioAuthToken) {
      return {
        status: "FAILED",
        provider: "twilio",
        messagePreview: params.message,
        waMeUrl,
        errorCode: "TWILIO_NOT_CONFIGURED",
      };
    }

    const fromRaw = (params.twilioWhatsAppFrom ?? "whatsapp:+14155238886").trim();
    const fromWhatsApp = fromRaw.startsWith("whatsapp:") ? fromRaw : `whatsapp:${fromRaw}`;
    const toWhatsApp = `whatsapp:${params.phoneE164}`;
    const authHeader = Buffer.from(
      `${params.twilioAccountSid.trim()}:${params.twilioAuthToken.trim()}`,
      "utf8"
    ).toString("base64");

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        params.twilioAccountSid.trim()
      )}/Messages.json`;

      // Enforce Twilio's 1,600-character WhatsApp body limit while always preserving the verbatim disclaimer
      const maxTwilioChars = 1580;
      let twilioBody = params.message;
      if (twilioBody.length > maxTwilioChars) {
        const suffix = `\n\n${MANDATORY_DISCLAIMER}`;
        const budget = Math.max(120, maxTwilioChars - suffix.length - 4);
        twilioBody = `${twilioBody.slice(0, budget).trimEnd()}...${suffix}`;
      }

      const formBody = new URLSearchParams({
        From: fromWhatsApp,
        To: toWhatsApp,
        Body: twilioBody,
      });

      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
        signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
      });

      if (!response.ok) {
        let twilioErrCode = `TWILIO_HTTP_${response.status}`;
        try {
          const errJson = (await response.json()) as { code?: number };
          if (typeof errJson?.code === "number") {
            twilioErrCode = `TWILIO_ERR_${errJson.code}`;
          }
        } catch {
          // Keep HTTP status code
        }
        logWarn("whatsapp.twilio_http_error", {
          status: response.status,
          error_code: twilioErrCode,
        });
        return {
          status: "FAILED",
          provider: "twilio",
          messagePreview: twilioBody,
          waMeUrl,
          errorCode: twilioErrCode,
        };
      }

      return {
        status: "SENT",
        provider: "twilio",
        messagePreview: twilioBody,
        waMeUrl,
        errorCode: null,
      };
    } catch (err) {
      logWarn("whatsapp.twilio_failed", {
        reason: err instanceof Error ? err.message : "unknown",
      });
      return {
        status: "FAILED",
        provider: "twilio",
        messagePreview: params.message,
        waMeUrl,
        errorCode: "TWILIO_NETWORK_ERROR",
      };
    }
  }

  if (params.provider === "callmebot") {
    if (!params.callMeBotApiKey || !params.callMeBotApiKey.trim()) {
      return {
        status: "FAILED",
        provider: "callmebot",
        messagePreview: params.message,
        waMeUrl,
        errorCode: "MISSING_CALLMEBOT_API_KEY",
      };
    }
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
        cleanDigits
      )}&text=${encodeURIComponent(params.message)}&apikey=${encodeURIComponent(
        params.callMeBotApiKey.trim()
      )}`;
      const response = await fetchImpl(url, {
        method: "GET",
        signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
      });
      if (!response.ok) {
        return {
          status: "FAILED",
          provider: "callmebot",
          messagePreview: params.message,
          waMeUrl,
          errorCode: `CALLMEBOT_HTTP_${response.status}`,
        };
      }
      return {
        status: "SENT",
        provider: "callmebot",
        messagePreview: params.message,
        waMeUrl,
        errorCode: null,
      };
    } catch (err) {
      logWarn("whatsapp.callmebot_failed", {
        reason: err instanceof Error ? err.message : "unknown",
      });
      return {
        status: "FAILED",
        provider: "callmebot",
        messagePreview: params.message,
        waMeUrl,
        errorCode: "CALLMEBOT_NETWORK_ERROR",
      };
    }
  }

  // Official Meta WhatsApp Cloud API (free developer sandbox / service tier)
  if (!params.metaAccessToken || !params.metaPhoneNumberId) {
    return {
      status: "FAILED",
      provider: "meta_cloud",
      messagePreview: params.message,
      waMeUrl,
      errorCode: "META_CLOUD_NOT_CONFIGURED",
    };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(
      params.metaPhoneNumberId
    )}/messages`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanDigits,
        type: "text",
        text: {
          preview_url: true,
          body: params.message,
        },
      }),
      signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        status: "FAILED",
        provider: "meta_cloud",
        messagePreview: params.message,
        waMeUrl,
        errorCode: `META_CLOUD_HTTP_${response.status}`,
      };
    }
    return {
      status: "SENT",
      provider: "meta_cloud",
      messagePreview: params.message,
      waMeUrl,
      errorCode: null,
    };
  } catch (err) {
    logWarn("whatsapp.meta_cloud_failed", {
      reason: err instanceof Error ? err.message : "unknown",
    });
    return {
      status: "FAILED",
      provider: "meta_cloud",
      messagePreview: params.message,
      waMeUrl,
      errorCode: "META_CLOUD_NETWORK_ERROR",
    };
  }
}
