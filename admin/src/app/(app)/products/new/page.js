"use client";

import { motion } from "framer-motion";
import { Check, ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";
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
      setSuccess(false);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-3 pb-6">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Create Product</p>
        <h1 className="text-[28px] font-semibold text-[var(--accent)]">New Product</h1>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <motion.div animate={{ width: `${progress}%` }} className="h-full rounded-full bg-[var(--highlight)]" />
        </div>
      </header>

      {step === 1 ? (
        <section className="card-surface space-y-3 p-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--text-secondary)]">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--text-secondary)]">Brand</span>
              <input
                value={form.brand}
                onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--text-secondary)]">Model Number</span>
              <input
                value={form.modelNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, modelNumber: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
              />
            </label>
          </div>

          <div>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">Category</p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, category }))}
                  className={`app-button rounded-2xl border px-3 py-2 text-xs ${
                    form.category === category ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--card-border)]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">Gender</p>
            <div className="grid grid-cols-2 gap-2">
              {genders.map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, gender }))}
                  className={`app-button rounded-2xl border px-3 py-2 text-xs ${
                    form.gender === gender ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--card-border)]"
                  }`}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--text-secondary)]">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="min-h-24 w-full rounded-2xl border border-[var(--card-border)] px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--text-secondary)]">Short Description</span>
            <input
              value={form.shortDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
              className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--text-secondary)]">Tags (comma separated)</span>
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="app-button flex h-11 w-full items-center justify-center gap-1 rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white"
          >
            Next <ChevronRight size={15} />
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card-surface space-y-3 p-3">
          {Object.entries(colorGroups).map(([color, variants]) => (
            <div key={color} className="rounded-2xl border border-[var(--card-border)] p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-zinc-300" style={{ background: color.toLowerCase() }} />
                  <p className="text-sm font-semibold">{color}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addVariant(color)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"
                >
                  <Plus size={12} /> Add Size
                </button>
              </div>

              <div className="space-y-2">
                {variants.map((variant) => (
                  <div key={variant.index} className="rounded-xl bg-zinc-50 p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={variant.size}
                        onChange={(event) => patchVariant(variant.index, {
                          size: event.target.value,
                          sku: buildSku(form.brand, form.modelNumber, variant.color, event.target.value),
                        })}
                        placeholder="Size"
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
                      />
                      <input
                        value={variant.color}
                        onChange={(event) =>
                          patchVariant(variant.index, {
                            color: event.target.value,
                            sku: buildSku(form.brand, form.modelNumber, event.target.value, variant.size),
                          })
                        }
                        placeholder="Color"
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        value={variant.sku}
                        onChange={(event) => patchVariant(variant.index, { sku: event.target.value })}
                        placeholder="SKU"
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
                      />
                      <input
                        value={variant.price}
                        onChange={(event) => patchVariant(variant.index, { price: event.target.value })}
                        placeholder="Price"
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        value={variant.compareAtPrice}
                        onChange={(event) => patchVariant(variant.index, { compareAtPrice: event.target.value })}
                        placeholder="Compare-at"
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
                      />
                      <input
                        value={variant.quantity}
                        onChange={(event) => patchVariant(variant.index, { quantity: event.target.value })}
                        placeholder="Initial stock"
                        className="h-9 rounded-xl border border-[var(--card-border)] px-2 text-xs outline-none"
                      />
                    </div>

                    <label className="mt-2 flex h-9 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)]">
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
            className="app-button h-10 w-full rounded-2xl border border-[var(--card-border)] text-sm"
          >
            Add Another Color
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="app-button h-11 flex-1 rounded-2xl border border-[var(--card-border)] text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="app-button flex h-11 flex-1 items-center justify-center gap-1 rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white"
            >
              Review <ChevronRight size={15} />
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card-surface space-y-3 p-3">
          <h2 className="text-base font-semibold">Review & Publish</h2>
          <div className="rounded-2xl bg-zinc-50 p-3 text-sm">
            <p className="font-semibold">{form.name}</p>
            <p className="text-[var(--text-secondary)]">{form.brand} · {form.modelNumber}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {form.category} · {form.gender}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {form.variants.length} variants configured
            </p>
          </div>

          <button
            type="button"
            disabled={publishing}
            onClick={publishProduct}
            className="app-button flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--highlight)] text-sm font-semibold text-white disabled:opacity-60"
          >
            {publishing ? <span className="brand-spinner h-4 w-4 rounded-full border-2 border-white border-t-transparent" /> : <Sparkles size={16} />}
            {publishing ? "Publishing..." : "Publish Product"}
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="app-button h-11 w-full rounded-2xl border border-[var(--card-border)] text-sm"
          >
            Back
          </button>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl bg-[color:rgba(91,140,90,0.14)] p-3 text-sm text-[var(--success)]"
            >
              <p className="inline-flex items-center gap-2 font-semibold">
                <Check size={16} /> Product published!
              </p>
              <div className="mt-1 text-xs text-[color:rgba(91,140,90,0.85)]">Redirecting to products...</div>
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
