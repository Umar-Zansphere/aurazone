"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ImagePlus,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
import EmptyState from "@/components/ui/empty-state";
import { apiFetch } from "@/lib/api";
import { formatCurrencyINR } from "@/lib/format";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  // Image editing
  const [editingImage, setEditingImage] = useState(null);
  const [imageAltDraft, setImageAltDraft] = useState("");

  // Add variant sheet
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [variantDraft, setVariantDraft] = useState({
    color: "",
    size: "",
    sku: "",
    price: "",
    compareAtPrice: "",
    quantity: "",
  });
  const [variantImageFiles, setVariantImageFiles] = useState([]);
  const [copyFromVariantId, setCopyFromVariantId] = useState("");
  const [addVariantSaving, setAddVariantSaving] = useState(false);

  // Delete variant confirmation
  const [deleteVariantConfirm, setDeleteVariantConfirm] = useState(null);

  // Tags
  const [newTag, setNewTag] = useState("");

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/admin/products/${id}`);
      setProduct(data);
      // Auto-select first variant if none selected
      if (!selectedVariantId && data?.variants?.length) {
        setSelectedVariantId(data.variants[0].id);
      }
    } catch (err) {
      setProduct(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id, selectedVariantId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // Selected variant object
  const selectedVariant = useMemo(() => {
    if (!product?.variants) return null;
    return product.variants.find((v) => v.id === selectedVariantId) || product.variants[0] || null;
  }, [product?.variants, selectedVariantId]);

  // Images for the selected variant
  const variantImages = useMemo(() => {
    return selectedVariant?.images || [];
  }, [selectedVariant]);

  // ---------- API helpers ----------

  const saveProductPatch = async (payload) => {
    if (!product) return;
    setActionError(null);
    try {
      const data = await apiFetch(`/admin/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setProduct(data.product);
    } catch {
      setActionError("Failed to save changes.");
    }
  };

  const updateVariant = async (variantId, payload) => {
    setActionError(null);
    try {
      await apiFetch(`/admin/variants/${variantId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await loadProduct();
    } catch {
      setActionError("Failed to update variant.");
    }
  };

  const updateInventory = async (variantId, quantity) => {
    try {
      await apiFetch(`/admin/variants/${variantId}/inventory`, {
        method: "PUT",
        body: JSON.stringify({ quantity }),
      });
      await loadProduct();
    } catch {
      // silent
    }
  };

  const deleteProduct = async () => {
    if (!product) return;
    try {
      await apiFetch(`/admin/products/${product.id}`, { method: "DELETE" });
      router.replace("/products");
    } catch {
      setActionError("Failed to delete product.");
    }
  };

  const addVariant = async () => {
    if (!product) return;
    setActionError(null);
    setAddVariantSaving(true);
    try {
      const result = await apiFetch(`/admin/products/${product.id}/variants`, {
        method: "POST",
        body: JSON.stringify({
          size: variantDraft.size,
          color: variantDraft.color,
          sku: variantDraft.sku,
          price: Number(variantDraft.price),
          compareAtPrice: variantDraft.compareAtPrice ? Number(variantDraft.compareAtPrice) : undefined,
          quantity: Number(variantDraft.quantity || 0),
        }),
      });

      const newVariantId = result?.variant?.id;

      // Copy images from existing variant if selected
      if (newVariantId && copyFromVariantId) {
        try {
          await apiFetch(`/admin/variants/${newVariantId}/images/copy`, {
            method: "POST",
            body: JSON.stringify({ sourceVariantId: copyFromVariantId }),
          });
        } catch {
          // non-critical
        }
      }

      // Upload new images
      if (newVariantId && variantImageFiles.length > 0) {
        for (const file of variantImageFiles) {
          const formData = new FormData();
          formData.append("image", file);
          try {
            await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/admin/variants/${newVariantId}/images`,
              { method: "POST", credentials: "include", body: formData }
            );
          } catch {
            // non-critical
          }
        }
      }

      setAddVariantOpen(false);
      resetVariantDraft();
      await loadProduct();
      if (newVariantId) setSelectedVariantId(newVariantId);
    } catch {
      setActionError("Failed to add variant.");
    } finally {
      setAddVariantSaving(false);
    }
  };

  const resetVariantDraft = () => {
    setVariantDraft({ color: "", size: "", sku: "", price: "", compareAtPrice: "", quantity: "" });
    setVariantImageFiles([]);
    setCopyFromVariantId("");
  };

  const deleteVariant = async (variantId) => {
    setActionError(null);
    try {
      await apiFetch(`/admin/variants/${variantId}`, { method: "DELETE" });
      setDeleteVariantConfirm(null);
      if (selectedVariantId === variantId) setSelectedVariantId(null);
      await loadProduct();
    } catch {
      setActionError("Failed to delete variant.");
    }
  };

  const updateImageAlt = async (imageId, altText) => {
    try {
      await apiFetch(`/admin/images/${imageId}`, {
        method: "PUT",
        body: JSON.stringify({ altText }),
      });
      setEditingImage(null);
      await loadProduct();
    } catch {
      setActionError("Failed to update image.");
    }
  };

  const uploadImage = async (variantId, file) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("isPrimary", "false");
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/admin/variants/${variantId}/images`,
        { method: "POST", credentials: "include", body: formData }
      );
      await loadProduct();
    } catch {
      setActionError("Failed to upload image.");
    }
  };

  const removeImage = async (imageId) => {
    try {
      await apiFetch(`/admin/images/${imageId}`, { method: "DELETE" });
      await loadProduct();
    } catch {
      // silent
    }
  };

  // Image file previews for add-variant sheet
  const addImageFile = (file) => {
    setVariantImageFiles((prev) => [...prev, file]);
  };

  const removeImageFile = (index) => {
    setVariantImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Copy-from variant preview images
  const copySourceImages = useMemo(() => {
    if (!copyFromVariantId || !product?.variants) return [];
    const sourceVariant = product.variants.find((v) => v.id === copyFromVariantId);
    return sourceVariant?.images || [];
  }, [copyFromVariantId, product?.variants]);

  // ---------- Loading / Error states ----------

  if (loading) {
    return (
      <div className="space-y-3 pb-6">
        <div className="skeleton h-12 rounded-[18px]" />
        <div className="skeleton h-56 rounded-[18px]" />
        <div className="skeleton h-56 rounded-[18px]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pt-6">
        <EmptyState
          title="Product not found"
          description="This product may have been deleted or the link is invalid."
          icon={AlertCircle}
          variant="error"
          action={{ label: "Back to Products", onClick: () => router.replace("/products") }}
        />
      </div>
    );
  }

  const variants = product.variants || [];

  return (
    <div className="space-y-3 pb-10">
      {/* Error Banner */}
      <AnimatePresence>
        {actionError && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="error-banner">
            <AlertCircle size={16} />
            {actionError}
            <button type="button" onClick={() => setActionError(null)} className="ml-auto text-xs underline">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-[var(--bg-app)]/95 pb-2 pt-1 backdrop-blur">
        <div className="card-surface flex items-center justify-between p-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate px-2">{product.name}</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* ─── Variant Selector ─── */}
      <section className="card-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="section-title">Variants</p>
          <button
            type="button"
            onClick={() => { resetVariantDraft(); setAddVariantOpen(true); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--highlight)]"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
          {variants.map((variant) => {
            const isSelected = selectedVariant?.id === variant.id;
            const qty = variant.inventory?.quantity || 0;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedVariantId(variant.id)}
                className={`shrink-0 rounded-[14px] border px-3 py-2 text-left transition-all ${isSelected
                    ? "border-[var(--highlight)] bg-[var(--highlight-soft)] shadow-sm"
                    : "border-[var(--border)] bg-white hover:bg-[var(--surface-hover)]"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-[var(--border-strong)]"
                    style={{ background: variant.color.toLowerCase() }}
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{variant.color}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  Size {variant.size} · {formatCurrencyINR(variant.price)}
                </p>
                <p className={`text-[10px] font-medium ${qty <= 0 ? "text-[var(--error)]" : qty < 10 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                  {qty <= 0 ? "Out of stock" : `${qty} in stock`}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Selected Variant Image Gallery ─── */}
      {selectedVariant && (
        <section className="card-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="section-title">
              Images
              <span className="ml-1.5 text-[var(--text-muted)]">
                ({variantImages.length})
              </span>
            </p>
          </div>

          <div className="hide-scrollbar flex snap-x gap-2 overflow-x-auto">
            {variantImages.map((image) => (
              <div key={image.id} className="group relative h-44 min-w-[78%] snap-start overflow-hidden rounded-[14px] bg-[var(--bg-app)] md:min-w-[40%] lg:min-w-[30%]">
                <Image src={image.url} alt={image.altText || product.name} fill className="object-cover" unoptimized />
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => { setEditingImage(image); setImageAltDraft(image.altText || ""); }}
                    className="grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white text-[10px] font-bold"
                    title="Edit alt text"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                {image.isPrimary && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-semibold text-white">
                    Primary
                  </span>
                )}
              </div>
            ))}

            {/* Upload button (always shown) */}
            <label className="grid h-44 min-w-[50%] cursor-pointer shrink-0 place-items-center rounded-[14px] border border-dashed border-[var(--border-strong)] bg-white text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] md:min-w-[30%]">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && selectedVariant) {
                    uploadImage(selectedVariant.id, file);
                  }
                  event.target.value = "";
                }}
              />
              <span className="inline-flex flex-col items-center gap-1.5">
                <ImagePlus size={20} className="text-[var(--text-muted)]" />
                <span className="text-xs">Add image</span>
              </span>
            </label>

            {/* Empty hint */}
            {variantImages.length === 0 && (
              <div className="flex h-44 min-w-[60%] items-center justify-center rounded-[14px] bg-[var(--bg-app)] text-xs text-[var(--text-muted)]">
                No images for this variant
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Selected Variant Details ─── */}
      {selectedVariant && (
        <section className="card-surface p-4 space-y-3">
          <p className="section-title">Variant Details</p>

          <div className="rounded-[14px] bg-[var(--bg-app)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="h-3.5 w-3.5 rounded-full border border-[var(--border-strong)]"
                style={{ background: selectedVariant.color.toLowerCase() }}
              />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {selectedVariant.color} · Size {selectedVariant.size}
              </p>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">SKU: {selectedVariant.sku}</p>
          </div>

          {/* Price fields */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="form-label">Price</span>
              <input
                key={`price-${selectedVariant.id}`}
                defaultValue={selectedVariant.price}
                onBlur={(event) => {
                  const nextPrice = Number(event.target.value);
                  if (Number.isFinite(nextPrice) && nextPrice !== Number(selectedVariant.price)) {
                    updateVariant(selectedVariant.id, { price: nextPrice });
                  }
                }}
                className="form-input text-sm"
                placeholder="Price"
              />
            </label>
            <label className="block">
              <span className="form-label">Compare Price</span>
              <input
                key={`compare-${selectedVariant.id}`}
                defaultValue={selectedVariant.compareAtPrice || ""}
                onBlur={(event) => {
                  const value = event.target.value;
                  updateVariant(selectedVariant.id, {
                    compareAtPrice: value === "" ? null : Number(value),
                  });
                }}
                className="form-input text-sm"
                placeholder="Compare"
              />
            </label>
          </div>

          {/* Stock control */}
          <div>
            <span className="form-label">Stock</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateInventory(selectedVariant.id, Math.max(0, (selectedVariant.inventory?.quantity || 0) - 1))}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-sm transition-colors hover:bg-[var(--surface-hover)]"
              >
                -
              </button>
              <span className="w-12 text-center text-sm font-bold">{selectedVariant.inventory?.quantity || 0}</span>
              <button
                type="button"
                onClick={() => updateInventory(selectedVariant.id, (selectedVariant.inventory?.quantity || 0) + 1)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-sm transition-colors hover:bg-[var(--surface-hover)]"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => updateVariant(selectedVariant.id, { isAvailable: !selectedVariant.isAvailable })}
                className={`ml-auto rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors ${selectedVariant.isAvailable
                    ? "border-[var(--success)] text-[var(--success)] bg-[rgba(47,107,79,0.04)]"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                  }`}
              >
                {selectedVariant.isAvailable ? "Available" : "Unavailable"}
              </button>
            </div>
          </div>

          {/* Delete variant */}
          <button
            type="button"
            onClick={() => setDeleteVariantConfirm(selectedVariant.id)}
            className="inline-flex items-center gap-1.5 text-[11px] text-[var(--error)] transition-colors hover:underline"
          >
            <Trash2 size={12} /> Delete this variant
          </button>
        </section>
      )}

      {/* ─── Product Info (common across variants) ─── */}
      <section className="card-surface space-y-4 p-4">
        <p className="section-title">Product Info</p>

        {[
          { key: "name", label: "Name" },
          { key: "brand", label: "Brand" },
          { key: "modelNumber", label: "Model Number" },
        ].map((field) => (
          <label key={field.key} className="block">
            <span className="form-label">{field.label}</span>
            <input
              defaultValue={product[field.key] || ""}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== (product[field.key] || "")) {
                  saveProductPatch({ [field.key]: value });
                }
              }}
              className="form-input"
            />
          </label>
        ))}

        <label className="block">
          <span className="form-label">Description</span>
          <textarea
            defaultValue={product.description || ""}
            onBlur={(event) => {
              const value = event.target.value;
              if (value !== (product.description || "")) {
                saveProductPatch({ description: value });
              }
            }}
            className="form-textarea"
          />
        </label>

        <div>
          <p className="form-label">Tags</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(product.tags || []).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => saveProductPatch({ tags: (product.tags || []).filter((item) => item !== tag) })}
                className="app-chip inline-flex items-center gap-1 rounded-full bg-[var(--highlight-soft)] px-2.5 py-1 text-[11px] text-[var(--text-primary)] transition-colors hover:bg-[var(--border)]"
              >
                {tag}
                <X size={11} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              placeholder="Add tag"
              className="form-input flex-1"
            />
            <button
              type="button"
              onClick={() => {
                const clean = newTag.trim();
                if (!clean) return;
                saveProductPatch({ tags: [...(product.tags || []), clean] });
                setNewTag("");
              }}
              className="app-button app-button-primary h-[44px] px-4 text-xs"
            >
              Add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => saveProductPatch({ isActive: !product.isActive })}
            className={`app-button h-10 text-sm ${product.isActive
                ? "border border-[var(--success)] text-[var(--success)] bg-[rgba(47,107,79,0.04)]"
                : "app-button-secondary"
              }`}
          >
            {product.isActive ? "✓ Active" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => saveProductPatch({ isFeatured: !product.isFeatured })}
            className={`app-button h-10 text-sm ${product.isFeatured
                ? "border border-[var(--highlight)] text-[var(--highlight)] bg-[var(--highlight-soft)]"
                : "app-button-secondary"
              }`}
          >
            {product.isFeatured ? "★ Featured" : "Feature"}
          </button>
        </div>
      </section>

      {/* ─── Danger Zone ─── */}
      <section className="card-surface border-[color:rgba(155,44,44,0.2)] p-4">
        <h3 className="text-sm font-semibold text-[var(--error)]">Danger Zone</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">This action cannot be undone.</p>
        <button
          type="button"
          onClick={deleteProduct}
          className="app-button app-button-danger mt-3 flex items-center gap-2 px-3 py-2 text-sm"
        >
          <Trash2 size={15} /> Delete Product
        </button>
      </section>

      {/* ===================== BOTTOM SHEETS ===================== */}

      {/* Delete Variant Confirmation */}
      <BottomSheet open={Boolean(deleteVariantConfirm)} onClose={() => setDeleteVariantConfirm(null)} title="Delete Variant" snap="half">
        <p className="text-sm text-[var(--text-secondary)]">
          This will permanently delete this variant and its images. This action cannot be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setDeleteVariantConfirm(null)}
            className="app-button app-button-secondary h-11 flex-1 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => deleteVariant(deleteVariantConfirm)}
            className="app-button h-11 flex-1 rounded-[14px] bg-[var(--error)] text-sm font-semibold text-white"
          >
            Delete
          </button>
        </div>
      </BottomSheet>

      {/* Edit Image Alt Text */}
      <BottomSheet open={Boolean(editingImage)} onClose={() => setEditingImage(null)} title="Edit Image" snap="half">
        {editingImage && (
          <div className="space-y-3">
            <div className="relative h-32 w-full overflow-hidden rounded-[14px] bg-[var(--bg-app)]">
              <Image src={editingImage.url} alt={editingImage.altText || ""} fill className="object-cover" unoptimized />
            </div>
            <div>
              <label className="form-label">Alt Text</label>
              <input
                value={imageAltDraft}
                onChange={(e) => setImageAltDraft(e.target.value)}
                placeholder="Describe this image"
                className="form-input"
              />
            </div>
            <button
              type="button"
              onClick={() => updateImageAlt(editingImage.id, imageAltDraft)}
              className="app-button app-button-primary h-11 w-full text-sm"
            >
              Save
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Add Variant Sheet (Enhanced) */}
      <BottomSheet open={addVariantOpen} onClose={() => { setAddVariantOpen(false); resetVariantDraft(); }} title="Add Variant" snap="full">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label">Color</label>
              <input
                value={variantDraft.color}
                onChange={(e) => setVariantDraft((prev) => ({ ...prev, color: e.target.value }))}
                placeholder="e.g. Black"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Size</label>
              <input
                value={variantDraft.size}
                onChange={(e) => setVariantDraft((prev) => ({ ...prev, size: e.target.value }))}
                placeholder="e.g. 9"
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">SKU</label>
            <input
              value={variantDraft.sku}
              onChange={(e) => setVariantDraft((prev) => ({ ...prev, sku: e.target.value }))}
              placeholder="Unique SKU"
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label">Price</label>
              <input
                value={variantDraft.price}
                onChange={(e) => setVariantDraft((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="₹"
                className="form-input"
                type="number"
              />
            </div>
            <div>
              <label className="form-label">Compare At</label>
              <input
                value={variantDraft.compareAtPrice}
                onChange={(e) => setVariantDraft((prev) => ({ ...prev, compareAtPrice: e.target.value }))}
                placeholder="₹"
                className="form-input"
                type="number"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Stock Quantity</label>
            <input
              value={variantDraft.quantity}
              onChange={(e) => setVariantDraft((prev) => ({ ...prev, quantity: e.target.value }))}
              placeholder="Initial stock"
              className="form-input"
              type="number"
            />
          </div>

          {/* ─── Image Section ─── */}
          <div className="section-divider" />

          <div>
            <p className="section-title mb-2">Images</p>

            {/* Copy from existing variant */}
            {variants.length > 0 && (
              <div className="mb-3">
                <label className="form-label flex items-center gap-1.5">
                  <Copy size={12} /> Copy images from an existing variant
                </label>
                <select
                  value={copyFromVariantId}
                  onChange={(e) => setCopyFromVariantId(e.target.value)}
                  className="form-select"
                >
                  <option value="">None — upload fresh images</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.color} · Size {v.size} ({(v.images || []).length} images)
                    </option>
                  ))}
                </select>

                {/* Preview copied images */}
                {copySourceImages.length > 0 && (
                  <div className="mt-2 hide-scrollbar flex gap-1.5 overflow-x-auto">
                    {copySourceImages.map((img) => (
                      <div key={img.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-app)]">
                        <Image src={img.url} alt={img.altText || ""} fill className="object-cover" unoptimized />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Check size={14} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload new images */}
            <label className="form-label">Upload additional images</label>
            <div className="flex flex-wrap gap-2">
              {variantImageFiles.map((file, index) => (
                <div key={index} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-app)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImageFile(index)}
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--error)] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              <label className="grid h-16 w-16 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-white transition-colors hover:bg-[var(--surface-hover)]">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) addImageFile(file);
                    e.target.value = "";
                  }}
                />
                <ImagePlus size={16} className="text-[var(--text-muted)]" />
              </label>
            </div>
          </div>

          {actionError && (
            <div className="error-banner text-xs">
              <AlertCircle size={14} />
              {actionError}
            </div>
          )}

          <button
            type="button"
            onClick={addVariant}
            disabled={addVariantSaving || !variantDraft.color || !variantDraft.size || !variantDraft.sku || !variantDraft.price}
            className="app-button app-button-primary h-11 w-full text-sm disabled:opacity-50"
          >
            {addVariantSaving ? "Creating..." : "Add Variant"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
