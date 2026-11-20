/**
 * Safe structured JSON logger with mandatory redaction of user tip text,
 * uploaded media payloads, Pause & Plan answers, prompts, and secrets.
 */

const SENSITIVE_KEY_PATTERN =
  /^(text|tip|tip_text|raw_text|transcript|ocr_text|file|buffer|media|payload|answers|pause_plan|prompt|authorization|cookie|token|secret|password|apikey|api_key|service_role|supabase_service_role_key|database_url|phone|phone_e164|phone_encrypted|callmebot_api_key|provider_config|provider_config_encrypted|unsubscribe_token|meta_whatsapp_access_token|twilio_auth_token|twilio_account_sid|subscription_encryption_key)$/i;

function sanitizeValue(key: string, value: unknown, depth = 0): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }
  if (depth > 4) {
    return "[TRUNCATED]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return "[REDACTED_BINARY]";
  }
  if (typeof value === "string") {
    // Redact Bearer tokens or inline JWTs if accidentally included
    if (/^Bearer\s+/i.test(value) || /^eyJ[A-Za-z0-9_-]+\./.test(value)) {
      return "[REDACTED_TOKEN]";
    }
    return value.length > 240 ? `${value.slice(0, 240)}...[TRUNCATED]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue("item", item, depth + 1));
  }
  if (typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [childKey, childVal] of Object.entries(value as Record<string, unknown>)) {
      clean[childKey] = sanitizeValue(childKey, childVal, depth + 1);
    }
    return clean;
  }
  return value;
}

export function redactLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = sanitizeValue(key, value, 0);
  }
  return sanitized;
}

function writeLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {}
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redactLogFields(fields),
  };
  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else if (process.env.NODE_ENV !== "test") {
    console.log(serialized);
  }
}

export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  writeLog("info", event, fields);
}

export function logWarn(event: string, fields: Record<string, unknown> = {}): void {
  writeLog("warn", event, fields);
}

export function logError(event: string, fields: Record<string, unknown> = {}): void {
  writeLog("error", event, fields);
}
