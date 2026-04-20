"use client";

import { motion } from "framer-motion";
import { Check, ChevronRight, Plus, Sparkles, Trash2, AlertCircle, ImagePlus, X, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

const categories = ["RUNNING", "CASUAL", "FORMAL", "SNEAKERS"];
const genders = ["MEN", "WOMEN", "UNISEX", "KIDS"];

const emptyVariant = () => ({
  color: "Black",
  size: "9",
  sku: "",
  price: "",
  compareAtPrice: "",
  quantity: "",
  images: [],
});

const buildSku = (brand, modelNumber, color, size) => {
  const base = `${brand || "PRD"}-${modelNumber || "GEN"}-${color || "BLK"}-${size || "00"}`;
  return base
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .toUpperCase();
};

export default function CreateProductPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [publishError, setPublishError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    modelNumber: "",
    category: "RUNNING",
    gender: "MEN",
    description: "",
    shortDescription: "",
    tags: "",
    variants: [emptyVariant()],
  });

  const progress = (step / 3) * 100;

  const colorGroups = useMemo(() => {
    const map = {};
    form.variants.forEach((variant, index) => {
      if (!map[variant.color]) {
        map[variant.color] = [];
      }
      map[variant.color].push({ ...variant, index });
    });
    return map;
  }, [form.variants]);

  const totalImages = useMemo(() => {
    return form.variants.reduce((sum, v) => sum + (v.images?.length || 0), 0);
  }, [form.variants]);

  const addVariant = (copyColor) => {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          ...emptyVariant(),
          color: copyColor || "Black",
          sku: buildSku(prev.brand, prev.modelNumber, copyColor || "Black", "10"),
        },
      ],
    }));
  };

  const patchVariant = (index, payload) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, idx) => (idx === index ? { ...variant, ...payload } : variant)),
    }));
  };

  const removeVariant = (index) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index),
    }));
  };

  const removeVariantImage = (variantIndex, imageIndex) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, idx) =>
        idx === variantIndex
          ? { ...variant, images: variant.images.filter((_, i) => i !== imageIndex) }
          : variant
      ),
    }));
  };

  const publishProduct = async () => {
    setPublishing(true);
    setPublishError(null);

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("brand", form.brand);
      formData.append("modelNumber", form.modelNumber);
      formData.append("category", form.category);
      formData.append("gender", form.gender);
      formData.append("description", form.description);
      formData.append("shortDescription", form.shortDescription);
      formData.append("tags", form.tags);

      const variantsPayload = form.variants.map((variant) => ({
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        price: Number(variant.price || 0),
        compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice) : undefined,
        quantity: Number(variant.quantity || 0),
      }));

      formData.append("variants", JSON.stringify(variantsPayload));

      form.variants.forEach((variant, index) => {
        (variant.images || []).forEach((file) => {
          formData.append(`images_${index}`, file);
        });
      });

      await apiFetch(`/admin/products`, {
        method: "POST",
        body: formData,
      });

      setSuccess(true);
      setTimeout(() => router.replace("/products"), 1500);
    } catch {
      setPublishError("Failed to publish product. Please check your inputs and try again.");
      setSuccess(false);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-3 pb-6">
      <header>
        <p className="page-label">Create Product</p>
        <h1 className="page-title">New Product</h1>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <motion.div animate={{ width: `${progress}%` }} className="h-full rounded-full bg-[var(--highlight)]" />
        </div>
        <div className="mt-2 flex gap-4">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => s < step && setStep(s)}
              className={`text-xs font-medium transition-colors ${step >= s ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} ${s < step ? "cursor-pointer hover:text-[var(--highlight)]" : ""}`}
            >
              {s === 1 ? "Details" : s === 2 ? "Variants" : "Review"}
            </button>
          ))}
        </div>
      </header>

      {/* ═══════════════════ STEP 1: PRODUCT DETAILS ═══════════════════ */}
      {step === 1 ? (
        <section className="card-surface space-y-4 p-4">
          <div>
            <label className="form-label">Name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="form-input"
              placeholder="Product name"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label">Brand</label>
              <input
                value={form.brand}
                onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
                className="form-input"
                placeholder="Brand"
              />
            </div>
            <div>
              <label className="form-label">Model Number</label>
              <input
                value={form.modelNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, modelNumber: event.target.value }))}
                className="form-input"
                placeholder="Model"
              />
            </div>
          </div>

          <div>
            <p className="form-label">Category</p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, category }))}
                  className={`app-button rounded-[14px] border px-3 py-2.5 text-xs transition-colors ${form.category === category
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="form-label">Gender</p>
            <div className="grid grid-cols-2 gap-2">
              {genders.map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, gender }))}
                  className={`app-button rounded-[14px] border px-3 py-2.5 text-xs transition-colors ${form.gender === gender
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="form-textarea"
              placeholder="Product description"
            />
          </div>

          <div>
            <label className="form-label">Short Description</label>
            <input
              value={form.shortDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
              className="form-input"
              placeholder="One-line summary"
            />
          </div>

          <div>
            <label className="form-label">Tags (comma separated)</label>
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              className="form-input"
              placeholder="running, sport, comfort"
            />
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!form.name || !form.brand}
            className="app-button app-button-primary flex h-11 w-full items-center justify-center gap-1 text-sm disabled:opacity-50"
          >
            Next <ChevronRight size={15} />
          </button>
        </section>
      ) : null}

      {/* ═══════════════════ STEP 2: VARIANTS & IMAGES ═══════════════════ */}
      {step === 2 ? (
        <section className="card-surface space-y-4 p-4">
          <p className="section-title">Sizes, Colors & Images</p>

          {Object.entries(colorGroups).map(([color, variants]) => (
            <div key={color} className="rounded-[14px] border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-[var(--border-strong)]" style={{ background: color.toLowerCase() }} />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{color}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addVariant(color)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--highlight)]"
                >
                  <Plus size={12} /> Add Size
                </button>
              </div>

              <div className="space-y-2.5">
                {variants.map((variant) => (
                  <div key={variant.index} className="rounded-xl bg-[var(--bg-app)] p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">Size</label>
                        <input
                          value={variant.size}
                          onChange={(event) => patchVariant(variant.index, {
                            size: event.target.value,
                            sku: buildSku(form.brand, form.modelNumber, variant.color, event.target.value),
                          })}
                          placeholder="Size"
                          className="form-input text-xs"
                        />
                      </div>
                      <div>
                        <label className="form-label">Color</label>
                        <input
                          value={variant.color}
                          onChange={(event) =>
                            patchVariant(variant.index, {
                              color: event.target.value,
                              sku: buildSku(form.brand, form.modelNumber, event.target.value, variant.size),
                            })
                          }
                          placeholder="Color"
                          className="form-input text-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">SKU</label>
                        <input
                          value={variant.sku}
                          onChange={(event) => patchVariant(variant.index, { sku: event.target.value })}
                          placeholder="SKU"
                          className="form-input text-xs"
                        />
                      </div>
                      <div>
                        <label className="form-label">Price</label>
                        <input
                          value={variant.price}
                          onChange={(event) => patchVariant(variant.index, { price: event.target.value })}
                          placeholder="₹"
                          className="form-input text-xs"
                          type="number"
                        />
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">Compare-at</label>
                        <input
                          value={variant.compareAtPrice}
                          onChange={(event) => patchVariant(variant.index, { compareAtPrice: event.target.value })}
                          placeholder="₹"
                          className="form-input text-xs"
                          type="number"
                        />
                      </div>
                      <div>
                        <label className="form-label">Initial stock</label>
                        <input
                          value={variant.quantity}
                          onChange={(event) => patchVariant(variant.index, { quantity: event.target.value })}
                          placeholder="0"
                          className="form-input text-xs"
                          type="number"
                        />
                      </div>
                    </div>

                    {/* ── Image Upload with Previews ── */}
                    <div className="mt-3">
                      <label className="form-label flex items-center gap-1">
                        <ImageIcon size={11} /> Images
                        {(variant.images?.length || 0) > 0 && (
                          <span className="ml-1 text-[var(--highlight)]">({variant.images.length})</span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(variant.images || []).map((file, imgIdx) => (
                          <div key={imgIdx} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--border)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={URL.createObjectURL(file)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeVariantImage(variant.index, imgIdx)}
                              className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--error)] text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        ))}
                        <label className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-white transition-colors hover:bg-[var(--surface-hover)]">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(event) => {
                              const files = Array.from(event.target.files || []);
                              patchVariant(variant.index, { images: [...(variant.images || []), ...files] });
                              event.target.value = "";
                            }}
                          />
                          <ImagePlus size={14} className="text-[var(--text-muted)]" />
                        </label>
                      </div>
                    </div>

                    {form.variants.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeVariant(variant.index)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--error)] hover:underline"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => addVariant()}
            className="app-button app-button-secondary h-10 w-full text-sm"
          >
            Add Another Color
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="app-button app-button-secondary h-11 flex-1 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={form.variants.some((v) => !v.sku || !v.price)}
              className="app-button app-button-primary flex h-11 flex-1 items-center justify-center gap-1 text-sm disabled:opacity-50"
            >
              Review <ChevronRight size={15} />
            </button>
          </div>
        </section>
      ) : null}

      {/* ═══════════════════ STEP 3: REVIEW & PUBLISH ═══════════════════ */}
      {step === 3 ? (
        <section className="card-surface space-y-4 p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Review & Publish</h2>

          {/* Product summary */}
          <div className="rounded-[14px] bg-[var(--bg-app)] p-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{form.name || "Untitled"}</p>
            <p className="text-xs text-[var(--text-secondary)]">{form.brand} · {form.modelNumber}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                {form.category}
              </span>
              <span className="inline-flex items-center rounded-full bg-[var(--highlight)] px-2 py-0.5 text-[10px] font-semibold text-white">
                {form.gender}
              </span>
            </div>
            {form.description && (
              <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2">{form.description}</p>
            )}
            {form.tags && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.tags.split(",").filter(Boolean).map((tag) => (
                  <span key={tag.trim()} className="rounded-full bg-[var(--highlight-soft)] px-2 py-0.5 text-[10px] text-[var(--text-primary)]">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Variants summary with images */}
          <div className="space-y-2">
            <p className="section-title">
              {form.variants.length} Variant{form.variants.length !== 1 ? "s" : ""} · {totalImages} Image{totalImages !== 1 ? "s" : ""}
            </p>
            {form.variants.map((variant, index) => (
              <div key={index} className="rounded-[14px] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-[var(--border-strong)]"
                      style={{ background: variant.color.toLowerCase() }}
                    />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {variant.color} · Size {variant.size}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    ₹{variant.price || 0}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  SKU: {variant.sku} · Stock: {variant.quantity || 0}
                  {variant.compareAtPrice ? ` · Compare: ₹${variant.compareAtPrice}` : ""}
                </p>

                {/* Image previews in review */}
                {(variant.images?.length || 0) > 0 && (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto hide-scrollbar">
                    {variant.images.map((file, imgIdx) => (
                      <div key={imgIdx} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-app)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {publishError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              {publishError}
            </div>
          )}

          <button
            type="button"
            disabled={publishing}
            onClick={publishProduct}
            className="app-button flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--highlight)] text-sm font-semibold text-white disabled:opacity-50"
          >
            {publishing ? <span className="brand-spinner h-4 w-4 rounded-full border-2 border-white border-t-transparent" /> : <Sparkles size={16} />}
            {publishing ? "Publishing..." : "Publish Product"}
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="app-button app-button-secondary h-11 w-full text-sm"
          >
            Back
          </button>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="success-banner relative overflow-hidden"
            >
              <p className="inline-flex items-center gap-2 font-semibold">
                <Check size={16} /> Product published!
              </p>
              <div className="mt-1 text-xs opacity-75">Redirecting to products...</div>
              <motion.span
                className="absolute right-3 top-2 text-lg"
                animate={{ y: [-6, -16, -6], rotate: [0, 20, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                🎉
              </motion.span>
            </motion.div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
