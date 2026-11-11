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
const isWindows = process.platform === "win32";

const runDeploySteps =
  process.env.WIZZ_SKIP_DEPLOY_STEPS !== "1" &&
  (process.argv.includes("--deploy") || process.env.WIZZ_DEPLOY === "1" || process.env.NODE_ENV === "production");

function run(label, command, args) {
  console.log(`\n[build] ${label}`);
  // Only npx needs a shell on Windows (npx.cmd); node is spawned directly so paths with spaces work
  const res = spawnSync(command, args, { cwd: root, env, stdio: "inherit", shell: isWindows && command === npx });
  if (res.status !== 0) {
    console.error(`[build] FAILED: ${label}`);
    process.exit(res.status ?? 1);
  }
}

const node = process.execPath;
const npx = isWindows ? "npx.cmd" : "npx";

if (runDeploySteps) {
  run("Checking environment variables", node, [path.join(__dirname, "check-deploy-env.js")]);
  run("Generating Prisma client", npx, ["prisma", "generate"]);
  run("Updating database schema (no data loss)", npx, ["prisma", "db", "push", "--skip-generate"]);
  run("Bootstrapping store, categories and admin", npx, ["tsx", path.join("scripts", "bootstrap-production.ts")]);
} else {
  console.log("[build] Deploy steps skipped (not a production build). Set NODE_ENV=production or pass --deploy to run them.");
}

const nextBin = require.resolve("next/dist/bin/next", { paths: [root] });
run("next build --webpack (low-resource mode)", node, [nextBin, "build", "--webpack"]);
run("Copying static assets into standalone output", node, [path.join(__dirname, "copy-standalone-assets.js")]);
console.log("\n[build] Done.");
