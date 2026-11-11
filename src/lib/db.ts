import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Connection pooling: hosted Postgres poolers (e.g. Supabase session mode) allow only a few
 * clients in total, while Prisma's default pool grows with the server's CPU count. Cap the
 * pool unless DATABASE_URL already sets connection_limit. Override with DB_CONNECTION_LIMIT.
 */
function databaseUrlWithPoolLimit(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.DB_CONNECTION_LIMIT || "5");
    } else if (process.env.DB_CONNECTION_LIMIT) {
      url.searchParams.set("connection_limit", process.env.DB_CONNECTION_LIMIT);
    }
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrlWithPoolLimit(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// One client per process (also in production: route modules can be evaluated more than once)
globalForPrisma.prisma = prisma;

export default prisma;
