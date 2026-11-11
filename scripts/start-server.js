/**
 * Production entry point: starts the Next.js standalone server.
 *
 * Managed container hosts (Cloudways Velocity, Docker, many PaaS) often set
 * HOSTNAME to the container's own name. The standalone server binds to
 * process.env.HOSTNAME, so it would then refuse traffic from the platform's proxy.
 * This wrapper always binds to BIND_HOST (default 0.0.0.0) and the platform PORT.
 */
const fs = require("fs");
const path = require("path");

const serverFile = path.join(__dirname, "..", ".next", "standalone", "server.js");
if (!fs.existsSync(serverFile)) {
  console.error(
    "[start] .next/standalone/server.js not found. Run the build first: npm run build (or npm run deploy:build)."
  );
  process.exit(1);
}

// Load .env / .env.production from the project root at every start, so edited values
// apply after a restart (the build only snapshots .env into .next/standalone).
require("@next/env").loadEnvConfig(path.join(__dirname, ".."), false, { info: () => {}, error: console.error });

process.env.HOSTNAME = process.env.BIND_HOST || "0.0.0.0";
process.env.PORT = process.env.PORT || "3000";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

console.log(`[start] WIZZ.PK listening on http://${process.env.HOSTNAME}:${process.env.PORT}`);
require(serverFile);
