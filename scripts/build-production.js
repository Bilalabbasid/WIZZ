/**
 * Production build for constrained hosts (Hostinger web/cloud hosting, small VPS),
 * run by `npm run deploy:build`.
 *
 * Shared hosting caps how many processes an account may start. Turbopack compiles
 * CSS (Tailwind/PostCSS) in a pool of child Node.js processes and crashes with
 * "creating new process" when it hits that cap. This build uses the webpack
 * bundler (CSS is compiled in-process) and, via WIZZ_LOW_RESOURCE_BUILD, tells
 * next.config.ts to use a single build worker.
 *
 * Local development keeps using `npm run build` / `next dev` (Turbopack).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const env = { ...process.env, WIZZ_LOW_RESOURCE_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1" };
const nextBin = require.resolve("next/dist/bin/next", { paths: [root] });

console.log("[build] next build --webpack (low-resource mode)");
const build = spawnSync(process.execPath, [nextBin, "build", "--webpack"], { cwd: root, env, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const copy = spawnSync(process.execPath, [path.join(__dirname, "copy-standalone-assets.js")], { cwd: root, env, stdio: "inherit" });
process.exit(copy.status ?? 1);
