import { NextResponse } from "next/server";
import { clientErrorMessage } from "@/lib/api-error";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Check PostgreSQL connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      storage: "available",
      brand: "WIZZ.PK",
      version: "1.0.0",
    });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Database connection failed");
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: message,
      },
      { status: 503 }
    );
  }
}
