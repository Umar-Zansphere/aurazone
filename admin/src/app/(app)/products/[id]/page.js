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
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
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
    try {
      const data = await apiFetch(`/admin/products/${id}`);
      setProduct(data);
    } catch {
      setProduct(null);
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
    const data = await apiFetch(`/admin/products/${product.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setProduct(data.product);
  };

  const updateVariant = async (variantId, payload) => {
    await apiFetch(`/admin/variants/${variantId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    await loadProduct();
  };

  const updateInventory = async (variantId, quantity) => {
    await apiFetch(`/admin/variants/${variantId}/inventory`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    });
    await loadProduct();
  };

  const deleteProduct = async () => {
    if (!product) return;

    await apiFetch(`/admin/products/${product.id}`, {
      method: "DELETE",
    });

    router.replace("/products");
  };

  const addVariant = async () => {
    if (!product) return;

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
  };

  const uploadImage = async (variantId, file) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("isPrimary", "true");

    await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/admin/variants/${variantId}/images`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    await loadProduct();
  };

  const removeImage = async (imageId) => {
    await apiFetch(`/admin/images/${imageId}`, { method: "DELETE" });
    await loadProduct();
  };

  if (loading) {
    return (
      <div className="space-y-3 pb-6">
        <div className="skeleton h-12 rounded-2xl" />
        <div className="skeleton h-56 rounded-[20px]" />
        <div className="skeleton h-56 rounded-[20px]" />
      </div>
    );
  }

  if (!product) {
    return <div className="card-surface p-6 text-sm text-[var(--text-secondary)]">Product not found.</div>;
  }

  const allImages = product.variants.flatMap((variant) => (variant.images || []).map((image) => ({ ...image, variantId: variant.id })));

  return (
    <div className="space-y-3 pb-10">
      <header className="sticky top-0 z-20 bg-[var(--bg-app)]/95 pb-2 pt-1 backdrop-blur">
        <div className="card-surface flex items-center justify-between p-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--card-border)]"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-semibold">{product.name}</h1>
          <button
            type="button"
            onClick={() => setImagesEdit((prev) => !prev)}
            className="text-xs font-semibold text-[var(--accent)]"
          >
            {imagesEdit ? "Done" : "Edit Images"}
          </button>
        </div>
      </header>

      <section className="card-surface p-3">
        <div className="hide-scrollbar flex snap-x gap-2 overflow-x-auto">
          {allImages.map((image) => (
            <div key={image.id} className="relative h-44 min-w-[78%] snap-start overflow-hidden rounded-2xl bg-zinc-100">
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
            <label className="grid h-44 min-w-[50%] place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-white text-sm text-[var(--text-secondary)]">
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
        </div>
      </section>

      <section className="card-surface space-y-3 p-3">
        <p className="text-xs font-medium text-[var(--text-secondary)]">Product Info</p>

        {[
          { key: "name", label: "Name" },
          { key: "brand", label: "Brand" },
          { key: "modelNumber", label: "Model Number" },
        ].map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-[11px] text-[var(--text-muted)]">{field.label}</span>
            <input
              defaultValue={product[field.key] || ""}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== (product[field.key] || "")) {
                  saveProductPatch({ [field.key]: value });
                }
              }}
              className="h-10 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
            />
          </label>
        ))}

        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Description</span>
          <textarea
            defaultValue={product.description || ""}
            onBlur={(event) => {
              const value = event.target.value;
              if (value !== (product.description || "")) {
                saveProductPatch({ description: value });
              }
            }}
            className="min-h-24 w-full rounded-2xl border border-[var(--card-border)] px-3 py-2 text-sm outline-none"
          />
        </label>

        <div>
          <p className="mb-1 block text-[11px] text-[var(--text-muted)]">Tags</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(product.tags || []).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => saveProductPatch({ tags: (product.tags || []).filter((item) => item !== tag) })}
                className="app-chip inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[11px]"
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
              className="h-10 flex-1 rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const clean = newTag.trim();
                if (!clean) return;
                saveProductPatch({ tags: [...(product.tags || []), clean] });
                setNewTag("");
              }}
              className="app-button h-10 rounded-2xl bg-[var(--accent)] px-3 text-xs font-semibold text-white"
            >
              Add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => saveProductPatch({ isActive: !product.isActive })}
            className="app-button rounded-2xl border border-[var(--card-border)] px-3 py-2 text-sm"
          >
            {product.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => saveProductPatch({ isFeatured: !product.isFeatured })}
            className="app-button rounded-2xl border border-[var(--card-border)] px-3 py-2 text-sm"
          >
            {product.isFeatured ? "Unfeature" : "Feature"}
          </button>
        </div>
      </section>

      <section className="card-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Sizes & Colors</p>
          <button
            type="button"
            onClick={() => setAddVariantOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"
          >
            <Plus size={13} /> Add Variant
          </button>
        </div>

        <div className="space-y-2.5">
          {Object.entries(grouped).map(([color, variants]) => (
            <div key={color} className="rounded-2xl border border-[var(--card-border)] p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-zinc-300" style={{ background: color.toLowerCase() }} />
                <p className="text-sm font-semibold">{color}</p>
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
                      className="app-chip min-w-[74px] rounded-2xl border border-[var(--card-border)] bg-white px-2 py-1.5 text-left"
                    >
                      <span className="block text-xs font-semibold">{variant.size}</span>
                      <span className="block text-[10px] text-[var(--text-secondary)]">
                        {formatCurrencyINR(variant.price)}
                      </span>
                      <span
                        className={`block text-[10px] ${
                          (variant.inventory?.quantity || 0) < 10 ? "text-[var(--warning)]" : "text-[var(--success)]"
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
                  <motion.div key={variant.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-2 rounded-2xl bg-zinc-50 p-2.5">
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
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
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
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
                        placeholder="Compare"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateInventory(variant.id, Math.max(0, (variant.inventory?.quantity || 0) - 1))}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--card-border)]"
                      >
                        -
                      </button>
                      <span className="w-10 text-center text-sm font-semibold">{variant.inventory?.quantity || 0}</span>
                      <button
                        type="button"
                        onClick={() => updateInventory(variant.id, (variant.inventory?.quantity || 0) + 1)}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--card-border)]"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVariant(variant.id, { isAvailable: !variant.isAvailable })}
                        className="ml-auto rounded-xl border border-[var(--card-border)] px-2 py-1 text-[10px]"
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

      <section className="card-surface border-[color:rgba(196,91,91,0.35)] p-3">
        <h3 className="text-sm font-semibold text-[var(--error)]">Danger Zone</h3>
        <button
          type="button"
          onClick={deleteProduct}
          className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[color:rgba(196,91,91,0.35)] px-3 py-2 text-sm text-[var(--error)]"
        >
          <Trash2 size={15} /> Delete Product
        </button>
      </section>

      <BottomSheet open={addVariantOpen} onClose={() => setAddVariantOpen(false)} title="Add Variant" snap="half">
        <div className="space-y-2">
          <input
            value={variantDraft.color}
            onChange={(event) => setVariantDraft((prev) => ({ ...prev, color: event.target.value }))}
            placeholder="Color"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <input
            value={variantDraft.size}
            onChange={(event) => setVariantDraft((prev) => ({ ...prev, size: event.target.value }))}
            placeholder="Size"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <input
            value={variantDraft.sku}
            onChange={(event) => setVariantDraft((prev) => ({ ...prev, sku: event.target.value }))}
            placeholder="SKU"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <input
            value={variantDraft.price}
            onChange={(event) => setVariantDraft((prev) => ({ ...prev, price: event.target.value }))}
            placeholder="Price"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <input
            value={variantDraft.compareAtPrice}
            onChange={(event) => setVariantDraft((prev) => ({ ...prev, compareAtPrice: event.target.value }))}
            placeholder="Compare At Price"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <input
            value={variantDraft.quantity}
            onChange={(event) => setVariantDraft((prev) => ({ ...prev, quantity: event.target.value }))}
            placeholder="Stock Quantity"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={addVariant}
            className="app-button h-11 w-full rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white"
          >
            Add Variant
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
