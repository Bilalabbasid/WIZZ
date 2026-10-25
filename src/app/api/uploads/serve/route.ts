import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { storageProvider } from "@/lib/storage";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const exp = searchParams.get("exp");
    const sig = searchParams.get("sig");

    if (!key) {
      return new NextResponse("Key parameter required", { status: 400 });
    }

    // Path traversal defense
    const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    if (normalizedKey.includes("..")) {
      return new NextResponse("Invalid file key", { status: 400 });
    }

    const isPublic = normalizedKey.startsWith("public/") || normalizedKey.startsWith("public\\");
    let isAuthorized = isPublic;

    // If private, verify authorization via HMAC or active session
    if (!isAuthorized) {
      const secret = process.env.JWT_SECRET || "wizz_storage_secret";

      if (exp && sig) {
        const expiresAt = Number(exp);
        if (Date.now() <= expiresAt) {
          const expectedSig = crypto.createHmac("sha256", secret).update(`${key}:${expiresAt}`).digest("hex");
          if (expectedSig === sig) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        const user = await getCurrentUser();
        if (user) {
          if (user.role === "PLATFORM_SUPER_ADMIN" || user.role === "PLATFORM_SUPPORT") {
            isAuthorized = true;
          } else {
            const { prisma } = await import("@/lib/db");
            const doc = await prisma.sellerDocument.findFirst({
              where: { fileKey: key },
              include: { application: true },
            });

            if (doc) {
              if (doc.application && doc.application.applicantUserId === user.id) {
                isAuthorized = true;
              } else if (doc.sellerOrgId) {
                const hasOrgMembership = user.memberships.some(
                  (m) => m.sellerOrgId === doc.sellerOrgId && m.isActive
                );
                if (hasOrgMembership) {
                  isAuthorized = true;
                }
              }
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      return new NextResponse("Unauthorized access to document", { status: 403 });
    }

    const fileData = storageProvider.getFileStream
      ? await storageProvider.getFileStream(normalizedKey)
      : null;

    if (!fileData) {
      return new NextResponse("File not found", { status: 404 });
    }

    const ext = path.extname(normalizedKey).toLowerCase();
    const contentType = fileData.mimeType || MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(fileData.buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isPublic
          ? "public, max-age=31536000, immutable"
          : "private, no-cache, no-store, must-revalidate",
        "Content-Disposition": isPublic ? "inline" : `inline; filename="${path.basename(normalizedKey)}"`,
        // Uploaded files are data, never documents that may run script on this origin
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error streaming file";
    return new NextResponse(message, { status: 500 });
  }
}
