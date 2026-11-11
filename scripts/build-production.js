/**
 * Production build, used by `npm run build` (so hosts that run the default build
 * command, like Hostinger's "Default" build settings, get it automatically).
 *
 * 1. Deploy steps, only on a server (NODE_ENV=production, `--deploy`, or WIZZ_DEPLOY=1;
 *    skip with WIZZ_SKIP_DEPLOY_STEPS=1):
 *      env check -> prisma generate -> prisma db push (never deletes data) ->
 *      bootstrap (first-party store, categories, admin from ADMIN_EMAIL/ADMIN_PASSWORD)
 * 2. `next build --webpack` with WIZZ_LOW_RESOURCE_BUILD=1 (single build worker).
 *    Shared hosting caps how many processes an account may start; Turbopack compiles
 *    CSS (Tailwind/PostCSS) in a pool of child processes and crashes there with
 *    "creating new process". Webpack compiles CSS in-process.
 * 3. Copy static assets into the standalone output.
 *
 * Local development keeps Turbopack via `next dev` (and `npm run build:turbo`).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const env = { ...process.env, WIZZ_LOW_RESOURCE_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1" };

const runDeploySteps =
  process.env.WIZZ_SKIP_DEPLOY_STEPS !== "1" &&
  (process.argv.includes("--deploy") || process.env.WIZZ_DEPLOY === "1" || process.env.NODE_ENV === "production");

// Errors that mean "the database is full right now", not "something is wrong"
const POOL_FULL = /EMAXCONNSESSION|max clients reached|too many (clients|connections)|remaining connection slots are reserved|Timed out fetching a new connection/i;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Runs a step. Output is streamed through (and kept, to recognise pooler-full errors).
 * options.attempts: retries for database-busy failures.
 * options.softOnPoolFull: if the database pooler is still full after all attempts, warn and
 *   continue instead of failing the deploy (used for idempotent steps that already succeeded
 *   on earlier deploys while the old release is holding the connections).
 */
function run(label, command, args, options = {}) {
  const attempts = options.attempts || 1;
  const childEnv = options.env || env;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`\n[build] ${label}${attempts > 1 ? ` (attempt ${attempt}/${attempts})` : ""}`);
    const res = spawnSync(command, args, { cwd: root, env: childEnv, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    if (res.status === 0) return true;

    const poolFull = POOL_FULL.test(`${res.stdout || ""}\n${res.stderr || ""}`);
    if (attempt < attempts && (poolFull || options.retryAnyFailure)) {
      const waitMs = 15000 * attempt;
      console.warn(`[build] ${label} failed (${poolFull ? "database connection pool is full" : "error"}); retrying in ${waitMs / 1000}s...`);
      sleep(waitMs);
      continue;
    }
    if (poolFull && options.softOnPoolFull) {
      console.warn(
        `\n[build] WARNING: ${label} skipped: the database connection pool is full (the running site is using it).\n` +
          `[build] WARNING: This is safe when this release has no database schema change. The new release caps its own\n` +
          `[build] WARNING: connections, so the next deploy will run this step normally.\n`
      );
      return false;
    }
    console.error(`[build] FAILED: ${label}`);
    process.exit(res.status ?? 1);
  }
  return false;
}

/**
 * Deploy steps open their own database connections while the live site is still running.
 * Hosted poolers (Supabase session mode: 15 clients) fill up quickly, so each step uses a
 * single connection.
 */
function singleConnectionEnv() {
  const raw = env.DATABASE_URL;
  const next = { ...env, DB_CONNECTION_LIMIT: "1" };
  if (!raw) return next;
  try {
    const url = new URL(raw);
    url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
    next.DATABASE_URL = url.toString();
  } catch {
    // leave unparsable URLs to the env check, which reports them clearly
  }
  return next;
}

// Resolve the project's own CLIs (never `npx`, which could download a different version)
function localBin(file, hint) {
  try {
    return require.resolve(file, { paths: [root] });
  } catch {
    console.error(`[build] Missing ${hint}. Run \`npm install\` (it is a regular dependency, so it installs even with NODE_ENV=production).`);
    process.exit(1);
  }
}

const node = process.execPath;

if (runDeploySteps) {
  const prismaCli = localBin("prisma/build/index.js", "the prisma package");
  const tsxCli = localBin("tsx/cli", "the tsx package");
  run("Checking environment variables", node, [path.join(__dirname, "check-deploy-env.js")]);
  run("Generating Prisma client", node, [prismaCli, "generate"]);
  const dbEnv = singleConnectionEnv();
  const dbOptions = { env: dbEnv, attempts: 4, softOnPoolFull: process.env.WIZZ_STRICT_DB_STEPS !== "1" };
  run("Updating database schema (no data loss)", node, [prismaCli, "db", "push", "--skip-generate"], dbOptions);
  run("Bootstrapping store, categories and admin", node, [tsxCli, path.join("scripts", "bootstrap-production.ts")], dbOptions);
} else {
  console.log("[build] Deploy steps skipped (not a production build). Set NODE_ENV=production or pass --deploy to run them.");
}

const nextBin = require.resolve("next/dist/bin/next", { paths: [root] });
// Pages are rendered on request, but keep any build-time queries to a small pool too
run("next build --webpack (low-resource mode)", node, [nextBin, "build", "--webpack"], { env: { ...env, DB_CONNECTION_LIMIT: "2" } });
run("Copying static assets into standalone output", node, [path.join(__dirname, "copy-standalone-assets.js")]);
console.log("\n[build] Done.");
