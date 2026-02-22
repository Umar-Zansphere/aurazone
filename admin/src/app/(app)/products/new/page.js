"use client";

import { motion } from "framer-motion";
import { Check, ChevronRight, Plus, Sparkles, Trash2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/admin/products`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to publish");
      }

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
            <span key={s} className={`text-xs font-medium ${step >= s ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              {s === 1 ? "Details" : s === 2 ? "Variants" : "Review"}
            </span>
          ))}
        </div>
      </header>

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
            className="app-button app-button-primary flex h-11 w-full items-center justify-center gap-1 text-sm"
          >
            Next <ChevronRight size={15} />
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card-surface space-y-4 p-4">
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
                          placeholder="Price"
                          className="form-input text-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">Compare-at</label>
                        <input
                          value={variant.compareAtPrice}
                          onChange={(event) => patchVariant(variant.index, { compareAtPrice: event.target.value })}
                          placeholder="Compare-at"
                          className="form-input text-xs"
                        />
                      </div>
                      <div>
                        <label className="form-label">Initial stock</label>
                        <input
                          value={variant.quantity}
                          onChange={(event) => patchVariant(variant.index, { quantity: event.target.value })}
                          placeholder="Stock"
                          className="form-input text-xs"
                        />
                      </div>
                    </div>

                    <label className="mt-2 flex h-10 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] text-xs text-[var(--text-secondary)] transition-colors hover:bg-white">
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          patchVariant(variant.index, { images: [...(variant.images || []), ...files] });
                        }}
                      />
                      Upload images for {variant.color}
                    </label>

                    {form.variants.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeVariant(variant.index)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--error)]"
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
              className="app-button app-button-primary flex h-11 flex-1 items-center justify-center gap-1 text-sm"
            >
              Review <ChevronRight size={15} />
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card-surface space-y-4 p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Review & Publish</h2>
          <div className="rounded-[14px] bg-[var(--bg-app)] p-3 text-sm">
            <p className="font-semibold text-[var(--text-primary)]">{form.name || "Untitled"}</p>
            <p className="text-[var(--text-secondary)]">{form.brand} · {form.modelNumber}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {form.category} · {form.gender}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {form.variants.length} variant{form.variants.length !== 1 ? "s" : ""} configured
            </p>
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
