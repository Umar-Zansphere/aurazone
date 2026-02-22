"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Plus,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
import EmptyState from "@/components/ui/empty-state";
import { apiFetch } from "@/lib/api";
import { formatCurrencyINR } from "@/lib/format";

function groupVariantsByColor(variants = []) {
  return variants.reduce((acc, variant) => {
    if (!acc[variant.color]) acc[variant.color] = [];
    acc[variant.color].push(variant);
    return acc;
  }, {});
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [expandedVariant, setExpandedVariant] = useState(null);
  const [imagesEdit, setImagesEdit] = useState(false);
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [variantDraft, setVariantDraft] = useState({
    color: "Black",
    size: "9",
    sku: "",
    price: "",
    compareAtPrice: "",
    quantity: "",
  });

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/admin/products/${id}`);
      setProduct(data);
    } catch (err) {
      setProduct(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const grouped = useMemo(() => groupVariantsByColor(product?.variants || []), [product?.variants]);

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
      await apiFetch(`/admin/products/${product.id}`, {
        method: "DELETE",
      });
      router.replace("/products");
    } catch {
      setActionError("Failed to delete product.");
    }
  };

  const addVariant = async () => {
    if (!product) return;
    setActionError(null);
    try {
      await apiFetch(`/admin/products/${product.id}/variants`, {
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

      setAddVariantOpen(false);
      setVariantDraft({ color: "Black", size: "9", sku: "", price: "", compareAtPrice: "", quantity: "" });
      await loadProduct();
    } catch {
      setActionError("Failed to add variant.");
    }
  };

  const uploadImage = async (variantId, file) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("isPrimary", "true");

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/admin/variants/${variantId}/images`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
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

  const allImages = product.variants.flatMap((variant) => (variant.images || []).map((image) => ({ ...image, variantId: variant.id })));

  return (
    <div className="space-y-3 pb-10">
      {actionError && (
        <div className="error-banner">
          <AlertCircle size={16} />
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-[var(--bg-app)]/95 pb-2 pt-1 backdrop-blur">
        <div className="card-surface flex items-center justify-between p-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">{product.name}</h1>
          <button
            type="button"
            onClick={() => setImagesEdit((prev) => !prev)}
            className="text-xs font-semibold text-[var(--highlight)]"
          >
            {imagesEdit ? "Done" : "Edit Images"}
          </button>
        </div>
      </header>

      <section className="card-surface p-3">
        <div className="hide-scrollbar flex snap-x gap-2 overflow-x-auto">
          {allImages.map((image) => (
            <div key={image.id} className="relative h-44 min-w-[78%] snap-start overflow-hidden rounded-[14px] bg-[var(--bg-app)]">
              <Image src={image.url} alt={image.altText || product.name} fill className="object-cover" unoptimized />
              {imagesEdit ? (
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ))}
          {imagesEdit ? (
            <label className="grid h-44 min-w-[50%] cursor-pointer place-items-center rounded-[14px] border border-dashed border-[var(--border-strong)] bg-white text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && product.variants[0]) {
                    uploadImage(product.variants[0].id, file);
                  }
                }}
              />
              <span className="inline-flex items-center gap-2">
                <ImagePlus size={16} /> Add image
              </span>
            </label>
          ) : null}
          {!allImages.length && !imagesEdit ? (
            <div className="flex h-44 w-full items-center justify-center rounded-[14px] bg-[var(--bg-app)] text-[var(--text-muted)]">
              No images uploaded
            </div>
          ) : null}
        </div>
      </section>

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
            className="app-button app-button-secondary h-10 text-sm"
          >
            {product.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => saveProductPatch({ isFeatured: !product.isFeatured })}
            className="app-button app-button-secondary h-10 text-sm"
          >
            {product.isFeatured ? "Unfeature" : "Feature"}
          </button>
        </div>
      </section>

      <section className="card-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="section-title">Sizes & Colors</p>
          <button
            type="button"
            onClick={() => setAddVariantOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--highlight)]"
          >
            <Plus size={13} /> Add Variant
          </button>
        </div>

        <div className="space-y-2.5">
          {Object.entries(grouped).map(([color, variants]) => (
            <div key={color} className="rounded-[14px] border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-[var(--border-strong)]" style={{ background: color.toLowerCase() }} />
                <p className="text-sm font-semibold text-[var(--text-primary)]">{color}</p>
              </div>

              <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                {variants.map((variant) => {
                  const isExpanded = expandedVariant === variant.id;
                  return (
                    <motion.button
                      layout
                      key={variant.id}
                      type="button"
                      onClick={() => setExpandedVariant((current) => (current === variant.id ? null : variant.id))}
                      className="app-chip min-w-[74px] rounded-[14px] border border-[var(--border)] bg-white px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <span className="block text-xs font-semibold text-[var(--text-primary)]">{variant.size}</span>
                      <span className="block text-[10px] text-[var(--text-secondary)]">
                        {formatCurrencyINR(variant.price)}
                      </span>
                      <span
                        className={`block text-[10px] ${(variant.inventory?.quantity || 0) < 10 ? "text-[var(--warning)]" : "text-[var(--success)]"
                          }`}
                      >
                        {variant.inventory?.quantity || 0} stock
                      </span>

                      {isExpanded ? <ChevronUp size={12} className="mt-1 text-[var(--text-muted)]" /> : <ChevronDown size={12} className="mt-1 text-[var(--text-muted)]" />}
                    </motion.button>
                  );
                })}
              </div>

              {variants.map((variant) => {
                if (expandedVariant !== variant.id) return null;

                return (
                  <motion.div key={variant.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 space-y-2.5 rounded-[14px] bg-[var(--bg-app)] p-3">
                    <p className="text-xs text-[var(--text-secondary)]">SKU: {variant.sku}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        defaultValue={variant.price}
                        onBlur={(event) => {
                          const nextPrice = Number(event.target.value);
                          if (Number.isFinite(nextPrice) && nextPrice !== Number(variant.price)) {
                            updateVariant(variant.id, { price: nextPrice });
                          }
                        }}
                        className="form-input text-xs"
                        placeholder="Price"
                      />
                      <input
                        defaultValue={variant.compareAtPrice || ""}
                        onBlur={(event) => {
                          const value = event.target.value;
                          updateVariant(variant.id, {
                            compareAtPrice: value === "" ? null : Number(value),
                          });
                        }}
                        className="form-input text-xs"
                        placeholder="Compare"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateInventory(variant.id, Math.max(0, (variant.inventory?.quantity || 0) - 1))}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] transition-colors hover:bg-white"
                      >
                        -
                      </button>
                      <span className="w-10 text-center text-sm font-semibold">{variant.inventory?.quantity || 0}</span>
                      <button
                        type="button"
                        onClick={() => updateInventory(variant.id, (variant.inventory?.quantity || 0) + 1)}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] transition-colors hover:bg-white"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVariant(variant.id, { isAvailable: !variant.isAvailable })}
                        className="ml-auto rounded-xl border border-[var(--border)] px-2.5 py-1 text-[10px] transition-colors hover:bg-white"
                      >
                        {variant.isAvailable ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

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

      <BottomSheet open={addVariantOpen} onClose={() => setAddVariantOpen(false)} title="Add Variant" snap="half">
        <div className="space-y-3">
          <div>
            <label className="form-label">Color</label>
            <input
              value={variantDraft.color}
              onChange={(event) => setVariantDraft((prev) => ({ ...prev, color: event.target.value }))}
              placeholder="Color"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Size</label>
            <input
              value={variantDraft.size}
              onChange={(event) => setVariantDraft((prev) => ({ ...prev, size: event.target.value }))}
              placeholder="Size"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">SKU</label>
            <input
              value={variantDraft.sku}
              onChange={(event) => setVariantDraft((prev) => ({ ...prev, sku: event.target.value }))}
              placeholder="SKU"
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label">Price</label>
              <input
                value={variantDraft.price}
                onChange={(event) => setVariantDraft((prev) => ({ ...prev, price: event.target.value }))}
                placeholder="Price"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Compare At</label>
              <input
                value={variantDraft.compareAtPrice}
                onChange={(event) => setVariantDraft((prev) => ({ ...prev, compareAtPrice: event.target.value }))}
                placeholder="Compare At Price"
                className="form-input"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Stock Quantity</label>
            <input
              value={variantDraft.quantity}
              onChange={(event) => setVariantDraft((prev) => ({ ...prev, quantity: event.target.value }))}
              placeholder="Initial stock"
              className="form-input"
            />
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="app-button app-button-primary h-11 w-full text-sm"
          >
            Add Variant
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
