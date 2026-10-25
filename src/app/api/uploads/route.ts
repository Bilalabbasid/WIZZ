import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { storageProvider } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { SellerDocumentType } from "@prisma/client";
import { CATALOG_WRITE_ROLES } from "@/modules/sellers/api-guard";

/** Identifies allowed file types from their leading bytes. */
function detectFileType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: ".jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: ".png" };
  if (buf.length >= 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a"))
    return { mime: "image/gif", ext: ".gif" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return { mime: "image/webp", ext: ".webp" };
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return { mime: "application/pdf", ext: ".pdf" };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as SellerDocumentType | null;
    const applicationId = formData.get("applicationId") as string | null;
    const sellerOrgId = formData.get("sellerOrgId") as string | null;
    const purpose = formData.get("purpose") as string | null;
    const isPublicRequested = formData.get("isPublic") === "true" || purpose === "product_image" || purpose === "store_media";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Enforce file size limit (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds maximum permitted size of 10MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Trust the file's bytes, not the browser-declared type or the filename
    const detected = detectFileType(buffer);
    if (!detected) {
      return NextResponse.json(
        { error: "This file isn't a real JPEG, PNG, WEBP or GIF image (PDF is accepted for documents only)." },
        { status: 400 }
      );
    }
    const safeName = `upload${detected.ext}`;

    // CASE 1: Public product or store media
    if (isPublicRequested || (!applicationId && !sellerOrgId && !documentType)) {
      if (detected.mime === "application/pdf") {
        return NextResponse.json(
          { error: "Product and store images must be JPEG, PNG, WEBP or GIF." },
          { status: 400 }
        );
      }

      // Platform admins, or seller members whose role can manage the catalog
      const canUploadCatalogMedia =
        user.role === "PLATFORM_SUPER_ADMIN" ||
        user.role === "PLATFORM_CATALOG_ADMIN" ||
        user.role === "PLATFORM_SUPPORT" ||
        user.memberships.some((m) => m.isActive && CATALOG_WRITE_ROLES.includes(m.role));

      if (!canUploadCatalogMedia) {
        return NextResponse.json(
          { error: "FORBIDDEN: Only merchants with catalog access and platform administrators can upload product media." },
          { status: 403 }
        );
      }

      // Upload to public storage
      const uploadResult = await storageProvider.uploadFile(buffer, safeName, detected.mime, false);

      return NextResponse.json({
        success: true,
        url: uploadResult.url,
        fileKey: uploadResult.fileKey,
        originalFilename: file.name,
      });
    }

    // CASE 2: Private KYC / compliance onboarding documents
    const effectiveDocType: SellerDocumentType = documentType || "BUSINESS_REGISTRATION";

    if (!applicationId && !sellerOrgId && user.role !== "PLATFORM_SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN: KYC Document must be associated with an application or seller organization." },
        { status: 403 }
      );
    }

    // Tenant isolation verification:
    if (applicationId && user.role !== "PLATFORM_SUPER_ADMIN") {
      const app = await prisma.sellerApplication.findUnique({ where: { id: applicationId } });
      if (!app || app.applicantUserId !== user.id) {
        return NextResponse.json({ error: "FORBIDDEN: You do not have access to this application." }, { status: 403 });
      }
    }

    if (sellerOrgId && user.role !== "PLATFORM_SUPER_ADMIN") {
      const hasMembership = user.memberships.some((m) => m.sellerOrgId === sellerOrgId && m.isActive);
      if (!hasMembership) {
        return NextResponse.json({ error: "FORBIDDEN: You do not have access to this seller organization." }, { status: 403 });
      }
    }

    // Upload to private storage
    const uploadResult = await storageProvider.uploadFile(buffer, safeName, detected.mime, true);

    // Save SellerDocument in DB
    const sellerDoc = await prisma.sellerDocument.create({
      data: {
        applicationId: applicationId || null,
        sellerOrgId: sellerOrgId || null,
        documentType: effectiveDocType,
        originalFilename: file.name,
        fileKey: uploadResult.fileKey,
        mimeType: uploadResult.mimeType,
        fileSizeBytes: uploadResult.sizeBytes,
        isVerified: false,
      },
    });

    return NextResponse.json({ success: true, document: sellerDoc, url: uploadResult.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error uploading file";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
