import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { getSettingsForAdmin, settingUpdateSchema, updateSetting } from "@/modules/admin/settings";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/settings — known keys with stored + effective values, and any other stored rows. */
export async function GET() {
  try {
    await requireRole(ADMIN_SECTION_ROLES.settings);
    const settings = await getSettingsForAdmin();
    return NextResponse.json(settings, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load settings.");
  }
}

/**
 * PUT /api/admin/settings  { key, value } — SUPER_ADMIN only, one key per request,
 * validated per key. The response's `wired` flag says whether any code reads the value.
 */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireRole(ADMIN_SECTION_ROLES.settings);
    const parsed = settingUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const setting = await updateSetting(admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, setting });
  } catch (err) {
    return adminErrorResponse(err, "Could not save the setting.");
  }
}
