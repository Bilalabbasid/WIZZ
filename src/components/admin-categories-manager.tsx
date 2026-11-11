"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, CornerDownRight } from "lucide-react";
import { AdminAlert, AdminDialog, adminRequest } from "@/components/admin-dialog";
import {
  AdminBadge,
  AdminEmptyState,
  adminCardCls,
  adminDangerBtn,
  adminInputCls,
  adminLabelCls,
  adminPrimaryBtn,
  adminSecondaryBtn,
} from "@/components/admin-ui";

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
}

interface FormState {
  name: string;
  slug: string;
  parentId: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  displayOrder: string;
}

const EMPTY_FORM: FormState = { name: "", slug: "", parentId: "", description: "", imageUrl: "", isActive: true, displayOrder: "0" };

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Depth-first ordering so children render under their parent. Orphans/cycles fall back to root. */
function toTree(rows: AdminCategoryRow[]) {
  const byParent = new Map<string | null, AdminCategoryRow[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const out: Array<AdminCategoryRow & { depth: number }> = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const r of byParent.get(parent) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ ...r, depth });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const r of rows) if (!seen.has(r.id)) out.push({ ...r, depth: 0 });
  return out;
}

function descendantsOf(rows: AdminCategoryRow[], id: string) {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.parentId && result.has(r.parentId) && !result.has(r.id)) {
        result.add(r.id);
        grew = true;
      }
    }
  }
  return result;
}

export function AdminCategoriesManager({ categories }: { categories: AdminCategoryRow[] }) {
  const router = useRouter();
  const tree = useMemo(() => toTree(categories), [categories]);
  const [editing, setEditing] = useState<AdminCategoryRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryRow | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setFormError(null);
    setEditing("new");
  };

  const openEdit = (c: AdminCategoryRow) => {
    setForm({
      name: c.name,
      slug: c.slug,
      parentId: c.parentId ?? "",
      description: c.description ?? "",
      imageUrl: c.imageUrl ?? "",
      isActive: c.isActive,
      displayOrder: String(c.displayOrder),
    });
    setSlugTouched(true);
    setFormError(null);
    setEditing(c);
  };

  const excludedParents = editing && editing !== "new" ? descendantsOf(categories, editing.id) : new Set<string>();

  const submit = async () => {
    const displayOrder = Number(form.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 9999) {
      setFormError("Display order must be a whole number from 0 to 9999.");
      return;
    }
    if (form.imageUrl.trim() && !form.imageUrl.trim().startsWith("https://")) {
      setFormError("Image URL must start with https://");
      return;
    }
    const payload = {
      name: form.name,
      slug: form.slug,
      parentId: form.parentId || null,
      description: form.description || null,
      imageUrl: form.imageUrl || null,
      isActive: form.isActive,
      displayOrder,
    };
    setSaving(true);
    setFormError(null);
    const res =
      editing === "new"
        ? await adminRequest("/api/admin/categories", "POST", payload)
        : await adminRequest(`/api/admin/categories/${(editing as AdminCategoryRow).id}`, "PATCH", payload);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setNotice({ tone: "success", text: editing === "new" ? `Category "${form.name}" created.` : `Category "${form.name}" saved.` });
    setEditing(null);
    router.refresh();
  };

  const toggleActive = async (c: AdminCategoryRow) => {
    setBusyId(c.id);
    const res = await adminRequest(`/api/admin/categories/${c.id}`, "PATCH", { isActive: !c.isActive });
    setBusyId(null);
    if (!res.ok) {
      setNotice({ tone: "error", text: res.error });
      return;
    }
    setNotice({ tone: "success", text: `"${c.name}" ${c.isActive ? "deactivated" : "activated"}.` });
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    const res = await adminRequest(`/api/admin/categories/${deleting.id}`, "DELETE");
    setBusyId(null);
    if (!res.ok) {
      setNotice({ tone: "error", text: res.error });
      setDeleting(null);
      return;
    }
    setNotice({ tone: "success", text: `"${deleting.name}" deleted.` });
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {categories.length} categories · {categories.filter((c) => c.isActive).length} active
        </p>
        <button type="button" className={adminPrimaryBtn} onClick={openCreate}>
          <Plus size={14} aria-hidden="true" /> New category
        </button>
      </div>

      {notice && (
        <AdminAlert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </AdminAlert>
      )}

      {tree.length === 0 ? (
        <AdminEmptyState title="No categories yet" description="Create the first category to start organising the catalog." />
      ) : (
        <div className={`${adminCardCls} overflow-x-auto`}>
          <table className="w-full text-left text-xs min-w-[760px]">
            <caption className="sr-only">Category tree</caption>
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3">Slug</th>
                <th scope="col" className="px-4 py-3 text-right">Products</th>
                <th scope="col" className="px-4 py-3 text-right">Order</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {tree.map((c) => {
                const deletable = c.productCount === 0 && c.childCount === 0;
                return (
                  <tr key={c.id} className={c.isActive ? "" : "opacity-70"}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5" style={{ paddingLeft: `${c.depth * 18}px` }}>
                        {c.depth > 0 && <CornerDownRight size={12} className="text-slate-500 shrink-0" aria-hidden="true" />}
                        <span className="font-semibold text-white">{c.name}</span>
                        {c.childCount > 0 && <span className="text-[10px] text-slate-500">({c.childCount} sub)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300">{c.slug}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">{c.productCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">{c.displayOrder}</td>
                    <td className="px-4 py-3">
                      <AdminBadge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</AdminBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className={adminSecondaryBtn} onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}>
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={adminSecondaryBtn}
                          onClick={() => void toggleActive(c)}
                          disabled={busyId === c.id}
                          aria-label={c.isActive ? `Deactivate ${c.name}` : `Activate ${c.name}`}
                          title={c.isActive ? "Deactivate" : "Activate"}
                        >
                          {c.isActive ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          className={adminSecondaryBtn}
                          onClick={() => setDeleting(c)}
                          disabled={!deletable || busyId === c.id}
                          aria-label={`Delete ${c.name}`}
                          title={deletable ? "Delete" : "Has products or sub-categories — deactivate instead"}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminDialog
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing === "new" ? "New category" : `Edit ${editing?.name ?? ""}`}
        wide
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cat-name" className={adminLabelCls}>Name</label>
              <input
                id="cat-name"
                required
                minLength={2}
                maxLength={80}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
                className={adminInputCls}
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="cat-slug" className={adminLabelCls}>Slug (URL: /categories/…)</label>
              <input
                id="cat-slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={80}
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
                }}
                className={`${adminInputCls} font-mono`}
                disabled={saving}
                aria-describedby="cat-slug-help"
              />
              <p id="cat-slug-help" className="text-[10px] text-slate-500 mt-1">
                Lowercase letters, digits and hyphens. Changing it changes the public URL.
              </p>
            </div>
            <div>
              <label htmlFor="cat-parent" className={adminLabelCls}>Parent</label>
              <select
                id="cat-parent"
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                className={adminInputCls}
                disabled={saving}
              >
                <option value="">— Top level —</option>
                {tree
                  .filter((c) => !excludedParents.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="cat-order" className={adminLabelCls}>Display order</label>
              <input
                id="cat-order"
                type="number"
                min={0}
                max={9999}
                step={1}
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                className={adminInputCls}
                disabled={saving}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cat-image" className={adminLabelCls}>Image URL (https only, optional)</label>
              <input
                id="cat-image"
                type="url"
                maxLength={500}
                placeholder="https://"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                className={adminInputCls}
                disabled={saving}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cat-desc" className={adminLabelCls}>Description (optional)</label>
              <textarea
                id="cat-desc"
                rows={3}
                maxLength={1000}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={adminInputCls}
                disabled={saving}
              />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-brand-500"
                disabled={saving}
              />
              Active (visible on the storefront)
            </label>
          </div>
          {formError && <AdminAlert tone="error">{formError}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={adminPrimaryBtn} disabled={saving}>
              {saving ? "Saving…" : editing === "new" ? "Create category" : "Save changes"}
            </button>
          </div>
        </form>
      </AdminDialog>

      <AdminDialog
        open={deleting !== null}
        onClose={() => busyId === null && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="This permanently removes the category. It has no products or sub-categories. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <button type="button" className={adminSecondaryBtn} onClick={() => setDeleting(null)} disabled={busyId !== null}>
            Cancel
          </button>
          <button type="button" className={adminDangerBtn} onClick={() => void confirmDelete()} disabled={busyId !== null}>
            {busyId ? "Deleting…" : "Delete category"}
          </button>
        </div>
      </AdminDialog>
    </div>
  );
}
