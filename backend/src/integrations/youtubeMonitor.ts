import { logWarn } from "../core/logger.js";

const YOUTUBE_TIMEOUT_MS = 8_000;

export interface YouTubeRssVideoItem {
  video_id: string;
  channel_id: string;
  title: string;
  video_url: string;
  thumbnail_url: string;
  published_at: string;
  description: string;
}

export interface YouTubeTranscriptResult {
  text: string;
  source: "CAPTIONS" | "METADATA_ONLY";
}

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .trim();
}

function extractTag(block: string, tagName: string): string | null {
  const escaped = tagName.replace(":", "\\:");
  const regex = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = regex.exec(block);
  return match?.[1] ? decodeXmlEntities(match[1]) : null;
}

function extractAttribute(block: string, tagName: string, attrName: string): string | null {
  const escaped = tagName.replace(":", "\\:");
  const regex = new RegExp(`<${escaped}[^>]*\\s${attrName}="([^"]+)"[^>]*\\/?>`, "i");
  const match = regex.exec(block);
  return match?.[1] ? decodeXmlEntities(match[1]) : null;
}

/**
 * Parses official YouTube Atom RSS XML (both channel feeds and WebSub push notifications).
 * Zero social scraping — strictly consumes YouTube's official public Atom XML feed.
 */
export function parseYouTubeAtomXml(xml: string, fallbackChannelId = ""): YouTubeRssVideoItem[] {
  const entries: YouTubeRssVideoItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1] ?? "";
    const videoId = extractTag(block, "yt:videoId");
    const channelId = extractTag(block, "yt:channelId") ?? fallbackChannelId;
    const title = extractTag(block, "title");
    const publishedAt = extractTag(block, "published") ?? new Date().toISOString();
    const linkHref = extractAttribute(block, "link", "href");
    const thumbnailUrl = extractAttribute(block, "media:thumbnail", "url");
    const description = extractTag(block, "media:description") ?? "";

    if (!videoId || !title) continue;

    const safeVideoId = videoId.replace(/[^A-Za-z0-9_-]/g, "");
    if (!safeVideoId) continue;

    entries.push({
      video_id: safeVideoId,
      channel_id: channelId,
      title,
      video_url:
        linkHref && /^https:\/\/(www\.)?youtube\.com\//i.test(linkHref)
          ? linkHref
          : `https://www.youtube.com/watch?v=${safeVideoId}`,
      thumbnail_url:
        thumbnailUrl && /^https:\/\//i.test(thumbnailUrl)
          ? thumbnailUrl
          : `https://i.ytimg.com/vi/${safeVideoId}/hqdefault.jpg`,
      published_at: publishedAt,
      description,
    });
  }

  return entries;
}

/**
 * Fetches latest real-time uploads from YouTube's official zero-cost public Atom RSS feed.
 */
export async function fetchYouTubeChannelRss(
  channelId: string,
  options: { limit?: number; fetchImpl?: typeof fetch } = {}
): Promise<YouTubeRssVideoItem[]> {
  const trimmedId = channelId.trim();
  if (!/^UC[A-Za-z0-9_-]{10,}$/.test(trimmedId)) {
    return [];
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 5;
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
    trimmedId
  )}`;

  try {
    const response = await fetchImpl(feedUrl, {
      headers: {
        Accept: "application/atom+xml, application/xml, text/xml",
        "User-Agent": "TipAutopsyEvidenceMonitor/1.0 (+https://tipautopsy.app)",
      },
      signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      logWarn("youtube_rss.fetch_failed", { channelId: trimmedId, status: response.status });
      return [];
    }
    const xml = await response.text();
    return parseYouTubeAtomXml(xml, trimmedId).slice(0, limit);
  } catch (err) {
    logWarn("youtube_rss.fetch_error", {
      channelId: trimmedId,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return [];
  }
}

/**
 * Attempts to fetch public YouTube timedtext caption tracks (English / Hindi),
 * falling back transparently to video title + description (METADATA_ONLY) when unavailable.
 */
export async function fetchPublicYouTubeTranscriptOrMetadata(
  video: Pick<YouTubeRssVideoItem, "video_id" | "title" | "description">,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<YouTubeTranscriptResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const candidateLangs = ["en", "en-IN", "hi"];

  for (const lang of candidateLangs) {
    try {
      const url = `https://www.youtube.com/api/timedtext?lang=${encodeURIComponent(
        lang
      )}&v=${encodeURIComponent(video.video_id)}`;
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) continue;
      const xml = await response.text();
      if (!xml.includes("<text")) continue;

      const chunks: string[] = [];
      const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/gi;
      let match: RegExpExecArray | null;
      while ((match = textRegex.exec(xml)) !== null) {
        const cleaned = decodeXmlEntities(match[1] ?? "").replace(/\s+/g, " ").trim();
        if (cleaned) chunks.push(cleaned);
      }
      const joined = chunks.join(" ").trim();
      if (joined.length >= 25) {
        return {
          text: `${video.title}\n\n${joined}`.slice(0, 3800),
          source: "CAPTIONS",
        };
      }
    } catch {
      // Ignore caption unavailability and try next language or fall back to metadata
    }
  }

  const metadataText = [video.title, video.description].filter(Boolean).join("\n\n").trim();
  return {
    text: metadataText.slice(0, 3800),
    source: "METADATA_ONLY",
  };
}
