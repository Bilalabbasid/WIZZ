import { prisma } from "../db";
import { JobStatus } from "@prisma/client";
import { cleanupExpiredReservations } from "@/modules/inventory/services";
import { cancelExpiredUnpaidOrders } from "@/modules/payments/services";
import { buildOrderEmail, sendEmail } from "../email";
import { syncDealPricing } from "@/modules/sellers/deal-pricing";

export type JobType =
  | "CLEANUP_EXPIRED_RESERVATIONS"
  | "SEND_TRANSACTIONAL_EMAIL"
  | "PROCESS_APPLICATION_STATUS"
  | "INDEX_SEARCH";

export interface JobPayload {
  [key: string]: unknown;
}

/**
 * Enqueues a durable background job in PostgreSQL.
 */
export async function enqueueJob(
  jobType: JobType,
  payload: JobPayload,
  scheduledAt: Date = new Date()
) {
  return prisma.backgroundJob.create({
    data: {
      jobType,
      payloadJson: JSON.stringify(payload),
      status: JobStatus.PENDING,
      scheduledAt,
    },
  });
}

async function handleEmailJob(payload: JobPayload) {
  const template = payload.template as "ORDER_CONFIRMATION" | "ORDER_SHIPPED" | undefined;
  if (template === "ORDER_CONFIRMATION" || template === "ORDER_SHIPPED") {
    const message = await buildOrderEmail(template, String(payload.orderId), {
      carrierName: payload.carrierName as string | undefined,
      trackingNumber: payload.trackingNumber as string | undefined,
      trackingUrl: payload.trackingUrl as string | null | undefined,
    });
    if (!message) return; // order no longer exists
    await sendEmail(message);
    return;
  }
  // Legacy raw email payloads
  if (typeof payload.to === "string" && typeof payload.subject === "string") {
    const body = String(payload.text ?? payload.subject);
    await sendEmail({ to: payload.to, subject: payload.subject, text: body, html: `<p>${body.replace(/</g, "&lt;")}</p>` });
  }
}

/**
 * Processes up to `limit` pending jobs. Each job is claimed with a conditional
 * update so two workers (or the HTTP cron and the in-process scheduler) can
 * never run the same job twice.
 */
export async function processPendingJobs(limit: number = 10): Promise<{ processed: number; errors: number }> {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  // Recover jobs that were claimed by a crashed process.
  await prisma.backgroundJob.updateMany({
    where: { status: JobStatus.RUNNING, startedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } },
    data: { status: JobStatus.PENDING },
  });

  const pendingJobs = await prisma.backgroundJob.findMany({
    where: {
      status: JobStatus.PENDING,
      scheduledAt: { lte: now },
    },
    take: limit,
    orderBy: { scheduledAt: "asc" },
  });

  for (const job of pendingJobs) {
    const claimed = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: JobStatus.PENDING },
      data: { status: JobStatus.RUNNING, startedAt: new Date() },
    });
    if (claimed.count === 0) continue;

    try {
      const payload = JSON.parse(job.payloadJson) as JobPayload;

      if (job.jobType === "CLEANUP_EXPIRED_RESERVATIONS") {
        await cleanupExpiredReservations();
      } else if (job.jobType === "SEND_TRANSACTIONAL_EMAIL") {
        await handleEmailJob(payload);
      }

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: JobStatus.COMPLETED, finishedAt: new Date() },
      });
      processed++;
    } catch (err: unknown) {
      errors++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRetriable = job.retryCount + 1 < job.maxRetries;

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: isRetriable ? JobStatus.PENDING : JobStatus.FAILED,
          retryCount: { increment: 1 },
          lastError: errorMessage.slice(0, 500),
          scheduledAt: isRetriable ? new Date(Date.now() + 60000 * (job.retryCount + 1)) : job.scheduledAt,
        },
      });
    }
  }

  return { processed, errors };
}

let maintenanceRunning = false;

/**
 * One maintenance tick: expire stale stock holds, cancel timed-out online-payment
 * orders, then deliver queued emails. Invoked by the HTTP cron endpoint and by the
 * in-process scheduler (instrumentation.ts). Re-entrancy guarded per process;
 * all operations are individually idempotent across processes.
 */
export async function runMaintenance(): Promise<{
  reservationsReleased: number;
  ordersCancelled: number;
  jobsProcessed: number;
  jobErrors: number;
  dealPricesUpdated: number;
}> {
  if (maintenanceRunning) {
    return { reservationsReleased: 0, ordersCancelled: 0, jobsProcessed: 0, jobErrors: 0, dealPricesUpdated: 0 };
  }
  maintenanceRunning = true;
  try {
    const { cleanedCount } = await cleanupExpiredReservations();
    const { cancelled } = await cancelExpiredUnpaidOrders();
    const jobs = await processPendingJobs(25);
    const deals = await syncDealPricing();
    return {
      reservationsReleased: cleanedCount,
      ordersCancelled: cancelled,
      jobsProcessed: jobs.processed,
      jobErrors: jobs.errors,
      dealPricesUpdated: deals.updated,
    };
  } finally {
    maintenanceRunning = false;
  }
}
