/**
 * Locks the Supabase data API out of the database (RLS on every public table, no grants to
 * anon/authenticated) and reports what is still exposed. Also runs on every deploy (bootstrap).
 *   npx tsx scripts/lock-down-data-api.ts           # report only
 *   npx tsx scripts/lock-down-data-api.ts --apply   # apply, then report
 */
import { prisma } from "../src/lib/db";
import { checkDataApiExposure, lockDownDataApi } from "../src/modules/finance/db-guards";

async function main() {
  const owner = await prisma.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
  const owners = await prisma.$queryRaw<Array<{ tableowner: string; n: bigint }>>`
    SELECT tableowner, count(*) AS n FROM pg_tables WHERE schemaname = 'public' GROUP BY tableowner`;
  console.log(`Connected as: ${owner[0]?.current_user}; public table owners: ${owners.map((o) => `${o.tableowner} (${o.n})`).join(", ")}`);
  const before = await checkDataApiExposure(prisma);
  console.log(`Before: ${before.tablesWithoutRls.length} tables without RLS, ${before.tablesReadableByApiRoles.length} tables granted to API roles`);
  if (!process.argv.includes("--apply")) {
    console.log("Report only. Re-run with --apply to lock down.");
    return;
  }
  const after = await lockDownDataApi(prisma);
  console.log(`After: ${after.tablesWithoutRls.length} tables without RLS, ${after.tablesReadableByApiRoles.length} tables granted to API roles`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
