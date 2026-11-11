import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AdminRuleError, writeAdminAudit } from "./http";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => {
    if (v === null) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Image URL must be a valid https:// address.");

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters.")
    .max(80)
    .regex(SLUG_RE, "Slug may contain lowercase letters, digits and single hyphens only."),
  parentId: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .transform((v) => (v ? v : null)),
  description: optionalText(1000),
  imageUrl: httpsUrl,
  isActive: z.boolean(),
  displayOrder: z.number().int("Display order must be a whole number.").min(0).max(9999),
});

export const categoryPatchSchema = categoryInputSchema.partial().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export type CategoryInput = z.infer<typeof categoryInputSchema>;
type Meta = { ipAddress: string | null; userAgent: string | null };

export async function listCategoriesForAdmin() {
  const rows = await prisma.category.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      parentId: true,
      displayOrder: true,
      isActive: true,
      updatedAt: true,
      _count: { select: { products: true, children: true } },
    },
  });
  return rows;
}

function revalidateCategoryPaths(slugs: string[]) {
  revalidatePath("/");
  revalidatePath("/products");
  for (const s of new Set(slugs)) revalidatePath(`/categories/${s}`);
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function assertParentValid(tx: Tx, categoryId: string | null, parentId: string | null) {
  if (!parentId) return;
  if (categoryId && parentId === categoryId) {
    throw new AdminRuleError("A category cannot be its own parent.");
  }
  const parent = await tx.category.findUnique({ where: { id: parentId }, select: { id: true } });
  if (!parent) throw new AdminRuleError("Selected parent category does not exist.");
  if (!categoryId) return;
  // Walk up from the proposed parent; reaching the category itself would create a cycle.
  let cursor: string | null = parentId;
  for (let depth = 0; cursor && depth < 50; depth++) {
    if (cursor === categoryId) {
      throw new AdminRuleError("That parent would create a loop (a category cannot sit under its own descendant).");
    }
    const row: { parentId: string | null } | null = await tx.category.findUnique({ where: { id: cursor }, select: { parentId: true } });
    cursor = row?.parentId ?? null;
  }
}

async function assertSlugFree(tx: Tx, slug: string, exceptId?: string) {
  const existing = await tx.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== exceptId) {
    throw new AdminRuleError(`The slug "${slug}" is already used by another category.`, 409);
  }
}

export async function createCategory(adminUserId: string, input: CategoryInput, meta: Meta) {
  const created = await prisma.$transaction(async (tx) => {
    await assertSlugFree(tx, input.slug);
    await assertParentValid(tx, null, input.parentId);
    const category = await tx.category.create({ data: input });
    await writeAdminAudit(tx, {
      actorUserId: adminUserId,
      entityType: "Category",
      entityId: category.id,
      action: "CATEGORY_CREATED",
      details: { ...input },
      meta,
    });
    return category;
  });
  revalidateCategoryPaths([created.slug]);
  return created;
}

export async function updateCategory(adminUserId: string, id: string, patch: Partial<CategoryInput>, meta: Meta) {
  const { before, after } = await prisma.$transaction(async (tx) => {
    const before = await tx.category.findUnique({ where: { id } });
    if (!before) throw new AdminRuleError("Category not found.", 404);
    if (patch.slug !== undefined && patch.slug !== before.slug) await assertSlugFree(tx, patch.slug, id);
    if (patch.parentId !== undefined) await assertParentValid(tx, id, patch.parentId);
    const after = await tx.category.update({ where: { id }, data: patch });

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(patch) as Array<keyof CategoryInput>) {
      if (before[key] !== after[key]) changes[key] = { from: before[key], to: after[key] };
    }
    await writeAdminAudit(tx, {
      actorUserId: adminUserId,
      entityType: "Category",
      entityId: id,
      action: patch.isActive !== undefined && Object.keys(patch).length === 1 ? (patch.isActive ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED") : "CATEGORY_UPDATED",
      details: { changes },
      meta,
    });
    return { before, after };
  });
  revalidateCategoryPaths([before.slug, after.slug]);
  return after;
}

export async function deleteCategory(adminUserId: string, id: string, meta: Meta) {
  const deleted = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new AdminRuleError("Category not found.", 404);
    if (category._count.products > 0) {
      throw new AdminRuleError(
        `"${category.name}" still has ${category._count.products} product(s). Move them or deactivate the category instead.`,
        409
      );
    }
    if (category._count.children > 0) {
      throw new AdminRuleError(
        `"${category.name}" has ${category._count.children} sub-categor${category._count.children === 1 ? "y" : "ies"}. Move them or deactivate the category instead.`,
        409
      );
    }
    await tx.category.delete({ where: { id } });
    await writeAdminAudit(tx, {
      actorUserId: adminUserId,
      entityType: "Category",
      entityId: id,
      action: "CATEGORY_DELETED",
      details: { name: category.name, slug: category.slug },
      meta,
    });
    return category;
  });
  revalidateCategoryPaths([deleted.slug]);
  return deleted;
}
