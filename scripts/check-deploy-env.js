/**
 * Pre-build check for production deploys (run by `npm run deploy:build`).
 * Fails fast with a readable list instead of a broken or insecure deployment.
 * Never prints secret values.
 */
const errors = [];
const warnings = [];
const env = process.env;

const placeholder = (v) => !v || /replace-with|change_me|changeme|example|your[-_]/i.test(v);

// Database
if (!env.DATABASE_URL) errors.push("DATABASE_URL is missing (PostgreSQL connection string).");
else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) errors.push("DATABASE_URL must start with postgresql://");
else if (/@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL) && env.ALLOW_LOCAL_DATABASE !== "true")
  warnings.push("DATABASE_URL points at localhost. On Cloudways use the connection string of the database you provisioned.");

// Secrets
for (const key of ["JWT_SECRET", "CRON_SECRET", "PAYMENT_WEBHOOK_SECRET"]) {
  const v = env[key];
  if (!v) errors.push(`${key} is missing. Generate one with: openssl rand -base64 32`);
  else if (placeholder(v)) errors.push(`${key} still has the placeholder value from .env.example.`);
  else if (v.length < 32) errors.push(`${key} must be at least 32 characters.`);
}
if (env.JWT_SECRET && env.JWT_SECRET === env.CRON_SECRET) errors.push("JWT_SECRET and CRON_SECRET must be different values.");

// URLs
for (const key of ["APP_URL", "NEXT_PUBLIC_APP_URL"]) {
  const v = env[key];
  if (!v) errors.push(`${key} is missing (e.g. https://wizz.pk).`);
  else if (!/^https:\/\//.test(v) && env.ALLOW_HTTP_APP_URL !== "true") errors.push(`${key} must start with https://`);
}

// Storage
const s3 = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT", "S3_PUBLIC_URL"];
const s3Set = s3.filter((k) => env[k]);
if (s3Set.length > 0 && s3Set.length < s3.length)
  errors.push(`Object storage is partly configured. Set all of: ${s3.join(", ")} (missing: ${s3.filter((k) => !env[k]).join(", ")}).`);
if (s3Set.length === 0)
  warnings.push(
    "No S3/R2 object storage configured: uploaded product photos and KYC documents are saved on the server disk " +
      `(${env.UPLOAD_DIR || "./.uploads"}). Make sure that folder survives redeploys, or configure S3_* variables.`
  );

// Email
if (!env.SMTP_HOST || !(env.SMTP_FROM || env.EMAIL_FROM))
  warnings.push("SMTP_HOST / SMTP_FROM not set: order confirmation and shipping emails will fail (jobs are retried).");
else if (!(env.SMTP_PASSWORD || env.SMTP_PASS)) warnings.push("SMTP_PASSWORD is empty.");

// Admin bootstrap
if ((env.ADMIN_EMAIL && !env.ADMIN_PASSWORD) || (!env.ADMIN_EMAIL && env.ADMIN_PASSWORD))
  errors.push("Set both ADMIN_EMAIL and ADMIN_PASSWORD (or neither).");
if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 12) errors.push("ADMIN_PASSWORD must be at least 12 characters.");
if (env.ADMIN_PASSWORD && placeholder(env.ADMIN_PASSWORD)) errors.push("ADMIN_PASSWORD still has the placeholder value from .env.example.");
if (env.ADMIN_EMAIL && /your-domain/i.test(env.ADMIN_EMAIL)) errors.push("ADMIN_EMAIL still has the placeholder value from .env.example.");

for (const w of warnings) console.warn(`  ! ${w}`);
if (errors.length) {
  console.error("\nDeploy configuration errors:");
  for (const e of errors) console.error(`  x ${e}`);
  console.error("\nFix these environment variables in your hosting dashboard and deploy again.\n");
  process.exit(1);
}
console.log("✓ Deploy environment looks complete.");
