import fs from "fs";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export interface UploadResult {
  fileKey: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface IStorageProvider {
  uploadFile(fileBuffer: Buffer, filename: string, mimeType: string, isPrivate?: boolean): Promise<UploadResult>;
  getSignedUrl(fileKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(fileKey: string): Promise<boolean>;
  getFileStream?(fileKey: string): Promise<{ buffer: Buffer; mimeType?: string } | null>;
}

class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.UPLOAD_DIR
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.join(process.cwd(), ".uploads");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(fileBuffer: Buffer, filename: string, mimeType: string, isPrivate: boolean = false): Promise<UploadResult> {
    const ext = path.extname(filename);
    const uniqueKey = `${isPrivate ? "private" : "public"}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    const destinationPath = path.join(this.baseDir, uniqueKey);

    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(destinationPath, fileBuffer);

    return {
      fileKey: uniqueKey,
      url: `/api/uploads/serve?key=${encodeURIComponent(uniqueKey)}`,
      originalFilename: filename,
      mimeType,
      sizeBytes: fileBuffer.length,
    };
  }

  async getSignedUrl(fileKey: string, _expiresInSeconds: number = 3600): Promise<string> {
    const secret = process.env.JWT_SECRET || "wizz_storage_secret";
    const expiresAt = Date.now() + _expiresInSeconds * 1000;
    const hmac = crypto.createHmac("sha256", secret).update(`${fileKey}:${expiresAt}`).digest("hex");
    return `/api/uploads/serve?key=${encodeURIComponent(fileKey)}&exp=${expiresAt}&sig=${hmac}`;
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, path.normalize(fileKey));
    if (filePath.startsWith(this.baseDir) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  async getFileStream(fileKey: string): Promise<{ buffer: Buffer; mimeType?: string } | null> {
    const filePath = path.join(this.baseDir, path.normalize(fileKey));
    if (!filePath.startsWith(this.baseDir) || !fs.existsSync(filePath)) {
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    return { buffer };
  }
}

class S3StorageProvider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || "";
    this.publicUrl = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");

    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || "auto";

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async uploadFile(fileBuffer: Buffer, filename: string, mimeType: string, isPrivate: boolean = false): Promise<UploadResult> {
    const ext = path.extname(filename);
    const uniqueKey = `${isPrivate ? "private" : "public"}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: uniqueKey,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    const url =
      !isPrivate && this.publicUrl
        ? `${this.publicUrl}/${uniqueKey}`
        : `/api/uploads/serve?key=${encodeURIComponent(uniqueKey)}`;

    return {
      fileKey: uniqueKey,
      url,
      originalFilename: filename,
      mimeType,
      sizeBytes: fileBuffer.length,
    };
  }

  async getSignedUrl(fileKey: string, _expiresInSeconds: number = 3600): Promise<string> {
    const secret = process.env.JWT_SECRET || "wizz_storage_secret";
    const expiresAt = Date.now() + _expiresInSeconds * 1000;
    const hmac = crypto.createHmac("sha256", secret).update(`${fileKey}:${expiresAt}`).digest("hex");
    return `/api/uploads/serve?key=${encodeURIComponent(fileKey)}&exp=${expiresAt}&sig=${hmac}`;
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getFileStream(fileKey: string): Promise<{ buffer: Buffer; mimeType?: string } | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        })
      );
      if (!response.Body) return null;
      const chunks: Uint8Array[] = [];
      // @ts-expect-error stream compatibility
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      return {
        buffer: Buffer.concat(chunks),
        mimeType: response.ContentType,
      };
    } catch {
      return null;
    }
  }
}

export const storageProvider: IStorageProvider =
  process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID
    ? new S3StorageProvider()
    : new LocalStorageProvider();
