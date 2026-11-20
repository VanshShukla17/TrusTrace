import { createApp } from "./app.js";
import { env } from "./core/env.js";
import { logInfo, logWarn } from "./core/logger.js";
import { createFinfluencerAlertRepository } from "./db/finfluencerRepository.js";
import { createEvidenceRepository } from "./db/repository.js";
import { pollAllTrackedFinfluencers } from "./domain/finfluencers/youtubeAlertPipeline.js";

const evidenceRepo = createEvidenceRepository(env);
const alertRepo = createFinfluencerAlertRepository(env);

const app = createApp({ config: env, repo: evidenceRepo, alertRepo });

let pollTimer: NodeJS.Timeout | null = null;
let pollInFlight = false;

async function runScheduledYouTubePoll(dispatchToSubscribers: boolean): Promise<void> {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    await pollAllTrackedFinfluencers({
      config: env,
      evidenceRepo,
      alertRepo,
      dispatchToSubscribers,
    });
  } catch (err) {
    logWarn("youtube_poller.cycle_failed", {
      reason: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    pollInFlight = false;
  }
}

const server = app.listen(env.PORT, () => {
  logInfo("server.started", {
    port: env.PORT,
    app_env: env.APP_ENV,
    allowed_origins_count: env.FRONTEND_ORIGINS.length,
    live_market_enabled: env.LIVE_MARKET_ENABLED,
    youtube_monitor_enabled: env.YOUTUBE_MONITOR_ENABLED,
  });

  if (env.YOUTUBE_MONITOR_ENABLED && env.NODE_ENV !== "test") {
    // Initial non-spam seed sync of latest videos on boot, followed by live alert polling
    setTimeout(() => {
      void runScheduledYouTubePoll(false);
    }, 5_000).unref();

    pollTimer = setInterval(() => {
      void runScheduledYouTubePoll(true);
    }, env.YOUTUBE_POLL_INTERVAL_MS);
    pollTimer.unref();
  }
});

function shutdown(signal: string): void {
  logInfo("server.shutdown", { signal });
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
