/**
 * Starts the in-process maintenance scheduler (expired stock holds, unpaid-order
 * timeouts, queued emails). Hostinger Node.js apps run a single long-lived process,
 * so this is the primary scheduler; the authenticated HTTP endpoint
 * /api/cron/cleanup remains available for an external cron as a backup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_INPROCESS_SCHEDULER === "true") return;
  if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_SCHEDULER !== "true") return;

  const globalState = globalThis as unknown as { __wizzScheduler?: NodeJS.Timeout };
  if (globalState.__wizzScheduler) return;

  const { runMaintenance } = await import("@/lib/jobs");
  const intervalMs = Math.max(30, Number(process.env.SCHEDULER_INTERVAL_SECONDS || 60)) * 1000;

  const tick = async () => {
    try {
      const r = await runMaintenance();
      if (r.reservationsReleased || r.ordersCancelled || r.jobsProcessed || r.jobErrors) {
        console.log(`[scheduler] ${JSON.stringify(r)}`);
      }
    } catch (err) {
      console.error("[scheduler] maintenance tick failed", err instanceof Error ? err.message : err);
    }
  };

  globalState.__wizzScheduler = setInterval(tick, intervalMs);
  globalState.__wizzScheduler.unref?.();
  console.log(`[scheduler] started, interval=${intervalMs / 1000}s`);
}
