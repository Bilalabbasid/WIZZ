/**
 * PM2 process config for a VPS (Hostinger, DigitalOcean, etc.).
 *   pm2 start ecosystem.config.js && pm2 save
 * Secrets are read from the project's .env by scripts/start-server.js, not stored here.
 */
module.exports = {
  apps: [
    {
      name: "wizz-pk",
      script: "scripts/start-server.js",
      cwd: __dirname,
      // One process: the in-app scheduler and rate limiter assume a single instance
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        BIND_HOST: "127.0.0.1", // only Nginx on this machine talks to the app
      },
      max_memory_restart: "1G",
      kill_timeout: 10000,
      time: true,
    },
  ],
};
