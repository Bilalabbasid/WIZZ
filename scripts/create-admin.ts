import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = args[0]?.trim().toLowerCase();
  const password = args[1];
  const fullName = args[2] || "Super Administrator";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <admin-email> <strong-password> [fullName]");
    console.error("Example: npx tsx scripts/create-admin.ts superadmin@wizz.pk 'SecurePass!2026' 'WIZZ Admin'");
    process.exit(1);
  }

  if (password.length < 10) {
    console.error("Error: Administrator password must be at least 10 characters long.");
    process.exit(1);
  }

  console.log(`🔐 Provisioning Platform Super Admin: ${email}...`);

  const passwordHash = await bcrypt.hash(password, 12);
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Super";
  const lastName = nameParts.slice(1).join(" ") || "Admin";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: UserRole.PLATFORM_SUPER_ADMIN,
      passwordHash,
      firstName,
      lastName,
      isEmailVerified: true,
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: UserRole.PLATFORM_SUPER_ADMIN,
      isEmailVerified: true,
    },
  });

  console.log(`✅ Administrator successfully provisioned!`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   Email:   ${user.email}`);
  console.log(`   Role:    ${user.role}`);
  console.log(`   Status:  ACTIVE`);
}

main()
  .catch((e) => {
    console.error("Failed to provision admin:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
