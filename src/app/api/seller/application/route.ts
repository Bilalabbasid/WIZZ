import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getSellerApplicationByUserId,
  saveApplicationDraft,
  submitSellerApplication,
} from "@/modules/sellers/services";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await getSellerApplicationByUserId(user.id);
    return NextResponse.json({ success: true, application });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching application";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action = "submit", ...formData } = body;

    if (action === "draft") {
      const draft = await saveApplicationDraft(user.id, formData);
      return NextResponse.json({ success: true, application: draft });
    }

    // Submit action requires fields
    if (!formData.legalBusinessName || !formData.tradingName || !formData.contactEmail) {
      return NextResponse.json(
        { error: "Legal business name, trading name, and contact email are required." },
        { status: 400 }
      );
    }

    const application = await submitSellerApplication(user.id, formData);
    return NextResponse.json({ success: true, application });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error saving application";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
