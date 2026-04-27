"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  Image as ImageIcon,
  ImagePlus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  Plus,
  Package,
  Tag,
  Palette,
  Eye,
  Zap,
  DownloadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

/* ─── constants ─────────────────────────────────────────────────── */
const categories = ["RUNNING", "CASUAL", "FORMAL", "SNEAKERS"];
const genders    = ["MEN", "WOMEN", "UNISEX", "KIDS"];
const suggestedSizes = ["6", "7", "8", "9", "10", "11", "12"];
const commonColors   = ["Black", "White", "Navy", "Grey", "Red", "Blue", "Green", "Brown"];

const CATEGORY_ICONS = { RUNNING: "🏃", CASUAL: "👟", FORMAL: "👞", SNEAKERS: "✨" };
const GENDER_ICONS   = { MEN: "♂", WOMEN: "♀", UNISEX: "⚥", KIDS: "★" };

/* ─── helpers ────────────────────────────────────────────────────── */
const emptyVariant = (color = "Black", size = "9", product = {}) => ({
  color,
  size,
  sku: buildSku(product.brand, product.modelNumber, color, size),
  price: "",
  compareAtPrice: "",
  quantity: "",
});

const buildSku = (brand, modelNumber, color, size) =>
  `${brand || "PRD"}-${modelNumber || "GEN"}-${color || "BLK"}-${size || "00"}`
    .replace(/\s+/g, "").replace(/[^A-Za-z0-9-]/g, "").toUpperCase();

const getColorKey = (color) => String(color || "").trim().toLowerCase();
const splitList   = (value) => String(value || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
const parseTags   = (value) => splitList(value);

const normalizeEnum = (value, allowed, fallback) => {
  const n = String(value || "").trim().toUpperCase();
  return allowed.includes(n) ? n : fallback;
};

const generateShortDescription = ({ name, brand, category, tags }) => {
  const title = [brand, name].filter(Boolean).join(" ").trim();
  if (!title) return "";
  const readableCategory = category ? category.toLowerCase() : "daily";
  const tagWords = parseTags(tags).slice(0, 2);
  const detail = tagWords.length > 0 ? ` with ${tagWords.join(" and ")} appeal` : "";
  return `${title} brings easy ${readableCategory.toLowerCase()} style${detail}.`;
};

const createImageItem = (file) => ({
  id: globalThis.crypto?.randomUUID?.() ||
    `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
  file,
  previewUrl: URL.createObjectURL(file),
  colors: [],
});

const createImportId = () =>
  globalThis.crypto?.randomUUID?.() || `import-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const uniqColors = (colors = []) => {
  const seen = new Set();
  return colors.filter((color) => {
    const key = getColorKey(color);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const cloneProductImages = (images = []) =>
  images.map((image) => ({ ...image, colors: [...(image.colors || [])] }));

const clonePendingImageRefs = (refs = []) =>
  refs.map((ref) => ({ ...ref, colors: [...(ref.colors || [])] }));

const cloneProductDraft = (product = {}) => ({
  ...product,
  variants: (product.variants || []).map((variant) => ({ ...variant })),
  productImages: cloneProductImages(product.productImages),
  pendingImageRefs: clonePendingImageRefs(product.pendingImageRefs),
});

const normalizeImportRef = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const sanitized = raw.split(/[?#]/)[0];
  const parts = sanitized.split(/[\\/]/).filter(Boolean);
  return (parts[parts.length - 1] || sanitized).toLowerCase();
};

const getImportRefKeys = (value) => {
  const normalized = normalizeImportRef(value);
  if (!normalized) return [];
  const stem = normalized.replace(/\.[^.]+$/, "");
  return Array.from(new Set([normalized, stem].filter(Boolean)));
};

const mergePendingImageRef = (refs, reference, colors = []) => {
  const normalized = normalizeImportRef(reference);
  if (!normalized) return refs;
  const nextColors = uniqColors(colors);
  const existingIndex = refs.findIndex((item) => item.normalized === normalized);
  if (existingIndex === -1) {
    return [
      ...refs,
      { id: `${normalized}-${refs.length}`, reference: String(reference).trim(), normalized, colors: nextColors },
    ];
  }
  return refs.map((item, index) =>
    index === existingIndex
      ? { ...item, colors: uniqColors([...(item.colors || []), ...nextColors]) }
      : item
  );
};

const summarizeImportedImages = (products = []) =>
  products.reduce(
    (summary, product) => ({
      matched: summary.matched + (product.productImages?.length || 0),
      pending: summary.pending + (product.pendingImageRefs?.length || 0),
    }),
    { matched: 0, pending: 0 }
  );

const createImageItemFromImport = (file, colors = [], reference = "") => ({
  ...createImageItem(file),
  colors: uniqColors(colors),
  sourceReference: reference,
});

const hasValidNumberInput = (value, required = false) => {
  if (value === undefined || value === null || value === "") {
    return !required;
  }

  return Number.isFinite(Number(value));
};

const getVariantLabel = (variant = {}, index = 0) =>
  `${variant.color || "Unknown"}/${variant.size || `#${index + 1}`}`;

const summarizeList = (items = [], limit = 3) => {
  if (items.length <= limit) return items.join(", ");
  return `${items.slice(0, limit).join(", ")}…`;
};

const getProductPublishIssues = (product = {}) => {
  const issues = [];
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (!String(product.name || "").trim() || !String(product.brand || "").trim()) {
    issues.push("name and brand are required");
  }

  const invalidVariants = variants
    .map((variant, index) => ({
      label: getVariantLabel(variant, index),
      valid: Boolean(
        String(variant.color || "").trim() &&
        String(variant.size || "").trim() &&
        String(variant.sku || "").trim() &&
        hasValidNumberInput(variant.price, true) &&
        hasValidNumberInput(variant.compareAtPrice) &&
        Number.isInteger(Number(variant.quantity || 0))
      ),
    }))
    .filter((entry) => !entry.valid)
    .map((entry) => entry.label);

  if (variants.length === 0) {
    issues.push("at least one variant is required");
  } else if (invalidVariants.length > 0) {
    issues.push(`complete variant details for ${summarizeList(invalidVariants)}`);
  }

  if (product.pendingImageRefs?.length > 0) {
    issues.push(`match ${product.pendingImageRefs.length} pending image reference${product.pendingImageRefs.length === 1 ? "" : "s"}`);
  }

  return issues;
};

const createBulkPublishReport = (total = 0) => ({
  total,
  processed: 0,
  succeeded: 0,
  failed: 0,
  currentName: "",
  failures: [],
});

const getPublishStatusStyles = (status) => {
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  if (status === "publishing") return "bg-[var(--highlight-soft)] text-[var(--highlight)]";
  if (status === "queued") return "bg-[var(--border)] text-[var(--text-secondary)]";
  return "bg-[var(--border)] text-[var(--text-secondary)]";
};

const getPublishStatusLabel = (status) => {
  if (status === "published") return "Created";
  if (status === "failed") return "Failed";
  if (status === "publishing") return "Publishing";
  if (status === "queued") return "Queued";
  return "";
};

const resolveImportedProductImages = (product, files = []) => {
  if (!product?.pendingImageRefs?.length || !files.length) return product;

  const fileIndex = Array.from(files).map((file) => ({
    file,
    keys: getImportRefKeys(file.name),
  }));

  const matchedImages = [];
  const pendingImageRefs = [];

  product.pendingImageRefs.forEach((ref) => {
    const match = fileIndex.find((entry) => ref.normalized && entry.keys.includes(ref.normalized));
    if (!match) {
      pendingImageRefs.push(ref);
      return;
    }
    matchedImages.push(createImageItemFromImport(match.file, ref.colors, ref.reference));
  });

  return {
    ...cloneProductDraft(product),
    productImages: [...cloneProductImages(product.productImages), ...matchedImages],
    pendingImageRefs: clonePendingImageRefs(pendingImageRefs),
  };
};

const getProductCompletion = (product = {}) => {
  const detailsReady = Boolean(String(product.name || "").trim() && String(product.brand || "").trim());
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variantsReady =
    variants.length > 0 &&
    variants.every((variant) =>
      variant.color &&
      variant.size &&
      variant.sku &&
      hasValidNumberInput(variant.price, true) &&
      hasValidNumberInput(variant.compareAtPrice) &&
      Number.isInteger(Number(variant.quantity || 0))
    );
  const imagesReady = (product.pendingImageRefs?.length || 0) === 0;

  return {
    detailsReady,
    variantsReady,
    imagesReady,
    readyToPublish: detailsReady && variantsReady && imagesReady,
  };
};

/* ─── CSV helpers ─────────────────────────────────────────────────── */
const headerAliases = {
  productname:"name",title:"name",name:"name",brand:"brand",model:"modelNumber",
  modelno:"modelNumber",modelnumber:"modelNumber",stylenumber:"modelNumber",
  category:"category",gender:"gender",description:"description",
  shortdescription:"shortDescription",summary:"shortDescription",tags:"tags",
  tag:"tags",color:"color",colour:"color",size:"size",sizes:"sizes",sku:"sku",
  price:"price",compareat:"compareAtPrice",compareatprice:"compareAtPrice",
  mrp:"compareAtPrice",quantity:"quantity",qty:"quantity",stock:"quantity",
  initialstock:"quantity",
  image:"imageRefs",images:"imageRefs",imageurl:"imageRefs",imageurls:"imageRefs",
  imagefile:"imageRefs",imagefiles:"imageRefs",filename:"imageRefs",filenames:"imageRefs",
  imageref:"imageRefs",imagerefs:"imageRefs",photo:"imageRefs",photos:"imageRefs",
  photoref:"imageRefs",photorefs:"imageRefs",imagecolor:"imageColors",
  imagecolors:"imageColors",imagecolour:"imageColors",imagecolours:"imageColors",
};

const normalizeHeader = (header) => {
  const key = String(header || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return headerAliases[key] || key;
};

const parseCsv = (text) => {
  const rows = []; let row = []; let value = ""; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && inQuotes && n === '"') { value += '"'; i++; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { row.push(value); value = ""; continue; }
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && n === "\n") i++;
      row.push(value);
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = []; value = ""; continue;
    }
    value += c;
  }
  row.push(value);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
};

const csvEscape = (v) => { const t = String(v ?? ""); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

const rowsToProducts = (rows) => {
  if (rows.length < 2) return { products: [], failures: [] };
  const headers = rows[0].map(normalizeHeader);
  const products = new Map();
  const failures = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const record = {};
    headers.forEach((h, i) => { record[h] = String(row[i] ?? "").trim(); });

    const rowIssues = [];
    if (!record.name || !record.brand) rowIssues.push("name and brand are required");
    if (record.price && !hasValidNumberInput(record.price)) rowIssues.push("price must be numeric");
    if (record.compareAtPrice && !hasValidNumberInput(record.compareAtPrice)) rowIssues.push("MRP must be numeric");
    if (record.quantity && (!Number.isInteger(Number(record.quantity)) || Number(record.quantity) < 0)) {
      rowIssues.push("quantity must be a whole number");
    }

    if (rowIssues.length > 0) {
      failures.push({
        rowNumber,
        name: record.name || record.brand || `Row ${rowNumber}`,
        message: rowIssues.join("; "),
      });
      return;
    }

    const key = [record.name, record.brand, record.modelNumber || "no-model"].join("|").toLowerCase();
    if (!products.has(key)) {
      products.set(key, {
        importId: createImportId(),
        name: record.name, brand: record.brand, modelNumber: record.modelNumber,
        category: normalizeEnum(record.category, categories, "RUNNING"),
        gender: normalizeEnum(record.gender, genders, "MEN"),
        description: record.description,
        shortDescription: record.shortDescription || generateShortDescription({ name: record.name, brand: record.brand, category: normalizeEnum(record.category, categories, "RUNNING"), tags: record.tags }),
        tags: record.tags, variants: [], productImages: [], pendingImageRefs: [],
      });
    }
    const product = products.get(key);
    const color = record.color || "Black";
    const sizes = splitList(record.sizes || record.size || "9");
    sizes.forEach((size) => {
      const sku = record.sku && sizes.length === 1 ? record.sku : buildSku(product.brand, product.modelNumber, color, size);
      const variantKey = `${getColorKey(color)}|${String(size)}|${String(sku)}`;
      const existingIndex = product.variants.findIndex((variant) =>
        `${getColorKey(variant.color)}|${String(variant.size)}|${String(variant.sku)}` === variantKey
      );
      const nextVariant = {
        color,
        size,
        sku,
        price: record.price,
        compareAtPrice: record.compareAtPrice,
        quantity: record.quantity || "0",
      };
      if (existingIndex === -1) {
        product.variants.push(nextVariant);
      } else {
        product.variants[existingIndex] = {
          ...product.variants[existingIndex],
          ...Object.fromEntries(Object.entries(nextVariant).filter(([, value]) => value !== "")),
        };
      }
    });

    const imageRefs = splitList(record.imageRefs);
    if (imageRefs.length > 0) {
      const imageColors = uniqColors(splitList(record.imageColors).length > 0 ? splitList(record.imageColors) : [color]);
      imageRefs.forEach((ref) => {
        product.pendingImageRefs = mergePendingImageRef(product.pendingImageRefs, ref, imageColors);
      });
    }
  });
  return {
    products: Array.from(products.values()).map((p) => ({
      ...p,
      variants: p.variants.length > 0 ? p.variants : [emptyVariant("Black", "9", p)],
      productImages: cloneProductImages(p.productImages),
      pendingImageRefs: clonePendingImageRefs(p.pendingImageRefs),
    })),
    failures,
  };
};

const getCsvTemplate = () => {
  const headers = ["name","brand","modelNumber","category","gender","description","shortDescription","tags","color","sizes","sku","price","compareAtPrice","quantity","imageRefs","imageColors"];
  const sample  = ["Velocity Pro","AuraZone","VP-100","RUNNING","MEN","Lightweight running shoe","","running, comfort","Black","6, 7, 8, 9, 10, 11","","1999","2499","10","velocity-black-1.jpg, velocity-black-2.jpg","Black"];
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`${headers.map(csvEscape).join(",")}\n${sample.map(csvEscape).join(",")}\n`)}`;
};

/* ─── sub-components ─────────────────────────────────────────────── */

function StepIndicator({ step, onGoTo }) {
  const steps = [
    { label: "Details",  icon: <Package size={14} /> },
    { label: "Variants", icon: <Palette size={14} /> },
    { label: "Review",   icon: <Eye size={14} /> },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const num = i + 1;
        const active    = step === num;
        const completed = step > num;
        const canClick  = num < step;
        return (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onGoTo(num)}
              className={`
                flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all
                ${active    ? "bg-[var(--highlight)] text-white shadow-sm" : ""}
                ${completed ? "text-[var(--highlight)] cursor-pointer" : ""}
                ${!active && !completed ? "text-[var(--text-muted)]" : ""}
              `}
            >
              {completed
                ? <Check size={12} />
                : <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${active ? "bg-white/20" : "bg-[var(--border)]"}`}>{num}</span>
              }
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div className={`mx-1 h-px flex-1 rounded-full transition-colors ${step > num ? "bg-[var(--highlight)]" : "bg-[var(--border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldGroup({ label, hint, children, action }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</label>
        {action}
      </div>
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      {children}
    </div>
  );
}

function ToggleChips({ options, value, onChange, renderLabel }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
              selected
                ? "border-[var(--accent)] bg-[var(--accent)] text-white scale-[1.02]"
                : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {renderLabel ? renderLabel(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

function AIToolbar({ form, colorNames, uniqueSizes, aiGeneratingTarget, aiError, onGenerate }) {
  const disabled = !form.name || !form.brand || aiGeneratingTarget !== null;
  const actions = [
    { target: "tags", label: "Tags", icon: <Tag size={12} /> },
    { target: "copy", label: "Copy", icon: <Wand2 size={12} /> },
    { target: "all",  label: "Fill All", icon: <Zap size={12} />, primary: true },
  ];
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--bg-app)] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles size={13} className="text-[var(--highlight)]" />
        <span className="text-xs font-semibold text-[var(--text-primary)]">AI Content Generator</span>
      </div>
      <p className="mb-3 text-[11px] text-[var(--text-muted)]">
        Generate tags, a short line, and product copy from the current details.
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ target, label, icon, primary }) => (
          <button
            key={target}
            type="button"
            disabled={disabled}
            onClick={() => onGenerate(target)}
            className={`flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold transition-all disabled:opacity-40 ${
              primary
                ? "bg-[var(--highlight)] text-white"
                : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {aiGeneratingTarget === target
              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              : icon
            }
            {aiGeneratingTarget === target ? "Generating…" : label}
          </button>
        ))}
      </div>
      {aiError && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--error)]">
          <AlertCircle size={11} /> {aiError}
        </p>
      )}
    </div>
  );
}

function ColorSwatch({ color, size = 12 }) {
  const colorMap = {
    black:"#111",white:"#fff",navy:"#1a2b4b",grey:"#9ca3af",gray:"#9ca3af",
    red:"#ef4444",blue:"#3b82f6",green:"#22c55e",brown:"#92400e",
  };
  const bg = colorMap[color.toLowerCase()] || color.toLowerCase();
  return (
    <span
      className="inline-block rounded-full border border-[var(--border-strong)] shrink-0"
      style={{ width: size, height: size, background: bg }}
    />
  );
}

function ImagePool({ form, colorNames, onAdd, onRemove, onToggleColor, onToggleAll }) {
  return (
    <div className="space-y-3">
      <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--border-strong)] text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--highlight)] hover:text-[var(--highlight)]">
        <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
        <ImagePlus size={16} />
        Tap to upload images
      </label>

      {form.productImages.length > 0 && (
        <div className="space-y-2">
          {form.productImages.map((image) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-app)] p-2.5"
            >
              <div className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemove(image.id)}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--error)] text-white shadow"
                  >
                    <X size={9} />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{image.file.name}</p>
                  <p className="mb-2 text-[10px] text-[var(--text-muted)]">Assign to colors:</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleAll(image.id)}
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors ${
                        colorNames.every((c) => image.colors.some((ic) => getColorKey(ic) === getColorKey(c)))
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      All
                    </button>
                    {colorNames.map((color) => {
                      const selected = image.colors.some((ic) => getColorKey(ic) === getColorKey(color));
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => onToggleColor(image.id, color)}
                          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors ${
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <ColorSwatch color={color} size={8} />
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantGrid({ color, variants, draft, suggestedSizes, selectedSizes, onPatchDraft, onApplySizes, onApplyDefaults, onPatchVariant, onRemoveVariant, onRenameColor, form }) {
  const [editingColor, setEditingColor] = useState(color);
  const tableRef = useRef(null);

  return (
    <div className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-surface)]">
      {/* color header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <ColorSwatch color={color} size={14} />
        <input
          value={editingColor}
          onChange={(e) => setEditingColor(e.target.value)}
          onBlur={() => onRenameColor(color, editingColor)}
          className="flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Color name"
        />
        <span className="text-[11px] text-[var(--text-muted)]">{variants.length} size{variants.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* size chips */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sizes</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedSizes.map((size) => {
              const selected = selectedSizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    const next = selected ? selectedSizes.filter((s) => s !== size) : [...selectedSizes, size];
                    onApplySizes(color, next, draft);
                  }}
                  className={`h-9 w-9 rounded-[10px] border text-xs font-semibold transition-all ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        {/* custom sizes + generate */}
        <div className="flex gap-2">
          <input
            value={draft.sizes}
            onChange={(e) => onPatchDraft(color, { sizes: e.target.value })}
            className="form-input flex-1 text-xs"
            placeholder="Custom sizes: 6, 7, 8…"
          />
          <button
            type="button"
            onClick={() => onApplySizes(color, splitList(draft.sizes), draft)}
            className="app-button app-button-secondary px-3 text-xs"
          >
            Apply
          </button>
        </div>

        {/* defaults row */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Defaults (apply to all sizes)</p>
            <button
              type="button"
              onClick={() => onApplyDefaults(color)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--highlight)]"
            >
              <Sparkles size={11} /> Apply
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "price",          placeholder: "Price (₹)" },
              { key: "compareAtPrice", placeholder: "MRP (₹)" },
              { key: "quantity",       placeholder: "Stock" },
            ].map(({ key, placeholder }) => (
              <input
                key={key}
                value={draft[key]}
                onChange={(e) => onPatchDraft(color, { [key]: e.target.value })}
                className="form-input text-xs"
                placeholder={placeholder}
                type="number"
                inputMode="numeric"
              />
            ))}
          </div>
        </div>

        {/* variant rows — horizontal scroll on mobile */}
        {variants.length > 0 && (
          <div className="overflow-x-auto -mx-3 px-3" ref={tableRef}>
            <div className="min-w-[480px]">
              <div className="mb-1.5 grid grid-cols-[44px_1fr_80px_80px_68px_32px] gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <span>Size</span><span>SKU</span><span>Price</span><span>MRP</span><span>Stock</span><span />
              </div>
              <div className="space-y-1.5">
                {variants.map((variant) => (
                  <motion.div
                    key={`${variant.color}-${variant.size}-${variant.index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-[44px_1fr_80px_80px_68px_32px] items-center gap-1.5"
                  >
                    <input
                      value={variant.size}
                      onChange={(e) => onPatchVariant(variant.index, { size: e.target.value, sku: buildSku(form.brand, form.modelNumber, variant.color, e.target.value) })}
                      className="form-input text-xs text-center"
                    />
                    <input
                      value={variant.sku}
                      onChange={(e) => onPatchVariant(variant.index, { sku: e.target.value })}
                      className="form-input font-mono text-[10px]"
                      placeholder="SKU"
                    />
                    <input value={variant.price} onChange={(e) => onPatchVariant(variant.index, { price: e.target.value })} className="form-input text-xs" placeholder="0" type="number" inputMode="numeric" />
                    <input value={variant.compareAtPrice} onChange={(e) => onPatchVariant(variant.index, { compareAtPrice: e.target.value })} className="form-input text-xs" placeholder="0" type="number" inputMode="numeric" />
                    <input value={variant.quantity} onChange={(e) => onPatchVariant(variant.index, { quantity: e.target.value })} className="form-input text-xs" placeholder="0" type="number" inputMode="numeric" />
                    <button type="button" onClick={() => onRemoveVariant(variant.index)} className="grid h-9 w-8 place-items-center rounded-lg text-[var(--error)] hover:bg-red-50 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FailureLog({ failures = [], limit = 5 }) {
  if (!failures.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Failed rows</p>
      {failures.slice(0, limit).map((failure, index) => (
        <div key={`${failure.rowNumber || failure.index || index}-${failure.name}-${failure.message}`} className="rounded-[10px] bg-red-50 px-3 py-2 text-[11px] text-red-800">
          <span className="font-semibold">
            {failure.rowNumber ? `Row ${failure.rowNumber}` : `Item ${(failure.index ?? index) + 1}`}: {failure.name || "Untitled product"}
          </span>
          <span className="block">{failure.message}</span>
        </div>
      ))}
      {failures.length > limit && (
        <p className="text-[11px] text-[var(--text-muted)]">+{failures.length - limit} more failed row{failures.length - limit === 1 ? "" : "s"}.</p>
      )}
    </div>
  );
}

function BulkPublishProgress({ report }) {
  if (!report) return null;

  const percent = report.total > 0 ? Math.round((report.processed / report.total) * 100) : 0;
  const done = report.total > 0 && report.processed >= report.total;

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-app)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Publish progress</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
            {done ? "Finished" : report.currentName ? `Working on ${report.currentName}` : "Ready"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
          report.failed > 0 ? "bg-red-100 text-red-700" : done ? "bg-emerald-100 text-emerald-700" : "bg-[var(--highlight-soft)] text-[var(--highlight)]"
        }`}>
          {report.processed}/{report.total}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
        <motion.div
          animate={{ width: `${percent}%` }}
          className="h-full rounded-full bg-[var(--highlight)]"
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[10px] bg-white p-2">
          <p className="text-base font-bold text-emerald-700">{report.succeeded}</p>
          <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Created</p>
        </div>
        <div className="rounded-[10px] bg-white p-2">
          <p className="text-base font-bold text-red-700">{report.failed}</p>
          <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Failed</p>
        </div>
        <div className="rounded-[10px] bg-white p-2">
          <p className="text-base font-bold text-[var(--text-primary)]">{Math.max(0, report.total - report.processed)}</p>
          <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Queued</p>
        </div>
      </div>

      <div className="mt-3">
        <FailureLog failures={report.failures} />
      </div>
    </div>
  );
}

function ImportedProductWorkbench({ products, activeImportId, onSelectProduct, onPublishAll, bulkPublishing, bulkPublishReport }) {
  const readyCount = products.filter((product) => getProductCompletion(product).readyToPublish).length;

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Imported Products</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Review each product across details, variants, and images before publishing the batch.
          </p>
        </div>
        <button
          type="button"
          onClick={onPublishAll}
          disabled={bulkPublishing}
          className="app-button app-button-primary h-12 px-3 text-xs font-semibold disabled:opacity-50"
        >
          {bulkPublishing ? "Publishing…" : "Publish All"}
        </button>
      </div>

      <BulkPublishProgress report={bulkPublishReport} />

      <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
        <span className="rounded-full bg-[var(--highlight-soft)] px-2.5 py-1 text-[var(--highlight)]">
          {readyCount}/{products.length} ready
        </span>
        <span className="rounded-full bg-[var(--border)] px-2.5 py-1 text-[var(--text-secondary)]">
          {products.reduce((sum, product) => sum + (product.variants?.length || 0), 0)} total variants
        </span>
        <span className="rounded-full bg-[var(--border)] px-2.5 py-1 text-[var(--text-secondary)]">
          {products.reduce((sum, product) => sum + (product.productImages?.length || 0), 0)} matched images
        </span>
      </div>

      <div className="grid gap-2">
        {products.map((product) => {
          const isActive = product.importId === activeImportId;
          const completion = getProductCompletion(product);
          return (
            <div
              key={product.importId}
              className={`rounded-[14px] border p-3 transition-colors ${
                isActive
                  ? "border-[var(--highlight)] bg-[var(--highlight-soft)]"
                  : "border-[var(--border)] bg-[var(--bg-app)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{product.name || "Untitled product"}</p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    {product.brand || "Missing brand"}{product.modelNumber ? ` · ${product.modelNumber}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${completion.readyToPublish ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {completion.readyToPublish ? "Ready" : "Needs review"}
                </span>
                {product.publishStatus && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPublishStatusStyles(product.publishStatus)}`}>
                    {getPublishStatusLabel(product.publishStatus)}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                <span className={`rounded-full px-2 py-1 ${completion.detailsReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  Details
                </span>
                <span className={`rounded-full px-2 py-1 ${completion.variantsReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  Variants
                </span>
                <span className={`rounded-full px-2 py-1 ${completion.imagesReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  Images
                </span>
                <span className="rounded-full bg-[var(--border)] px-2 py-1 text-[var(--text-secondary)]">
                  {product.variants?.length || 0} variant{product.variants?.length === 1 ? "" : "s"}
                </span>
                <span className="rounded-full bg-[var(--border)] px-2 py-1 text-[var(--text-secondary)]">
                  {product.productImages?.length || 0} image{product.productImages?.length === 1 ? "" : "s"}
                </span>
                {product.pendingImageRefs?.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                    {product.pendingImageRefs.length} pending refs
                  </span>
                )}
              </div>

              {product.publishError && (
                <p className="mt-2 rounded-[10px] bg-red-50 px-3 py-2 text-[11px] text-red-800">
                  {product.publishError}
                </p>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectProduct(product, 1)}
                  className="app-button app-button-secondary h-9 text-[11px] font-semibold"
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => onSelectProduct(product, 2)}
                  className="app-button app-button-secondary h-9 text-[11px] font-semibold"
                >
                  Variants
                </button>
                <button
                  type="button"
                  onClick={() => onSelectProduct(product, 3)}
                  className="app-button app-button-secondary h-9 text-[11px] font-semibold"
                >
                  Review
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────────────── */
export default function CreateProductPage() {
  const router = useRouter();
  const [step,            setStep]            = useState(1);
  const [publishing,      setPublishing]      = useState(false);
  const [bulkPublishing,  setBulkPublishing]  = useState(false);
  const [success,         setSuccess]         = useState(false);
  const [publishError,    setPublishError]    = useState(null);
  const [importStatus,    setImportStatus]    = useState(null);
  const [importFailures,  setImportFailures]  = useState([]);
  const [importedProducts,setImportedProducts]= useState([]);
  const [bulkPublishReport, setBulkPublishReport] = useState(null);
  const [activeImportId,  setActiveImportId]  = useState(null);
  const [shortDescriptionTouched, setShortDescriptionTouched] = useState(false);
  const [aiGeneratingTarget, setAiGeneratingTarget] = useState(null);
  const [aiError,         setAiError]         = useState(null);
  const [newColor,        setNewColor]        = useState("");
  const [gridDrafts,      setGridDrafts]      = useState({});
  const [importOpen,      setImportOpen]      = useState(false);

  const [form, setForm] = useState({
    name: "", brand: "", modelNumber: "",
    category: "RUNNING", gender: "MEN",
    description: "", shortDescription: "", tags: "",
    variants: [emptyVariant("Black", "9")],
    productImages: [],
    pendingImageRefs: [],
  });

  const csvTemplateHref = useMemo(getCsvTemplate, []);
  const importImageSummary = useMemo(() => summarizeImportedImages(importedProducts), [importedProducts]);
  const activeImportedProduct = useMemo(
    () => importedProducts.find((product) => product.importId === activeImportId) || null,
    [importedProducts, activeImportId]
  );

  const generatedShortDescription = useMemo(
    () => generateShortDescription({ name: form.name, brand: form.brand, category: form.category, tags: form.tags }),
    [form.name, form.brand, form.category, form.tags]
  );

  useEffect(() => {
    if (shortDescriptionTouched) return;
    setForm((prev) =>
      prev.shortDescription === generatedShortDescription ? prev : { ...prev, shortDescription: generatedShortDescription }
    );
  }, [generatedShortDescription, shortDescriptionTouched]);

  const colorGroups = useMemo(() => {
    const map = {};
    form.variants.forEach((v, i) => {
      const color = v.color || "Black";
      if (!map[color]) map[color] = [];
      map[color].push({ ...v, index: i });
    });
    return map;
  }, [form.variants]);

  const colorNames = useMemo(() => Object.keys(colorGroups), [colorGroups]);

  const totalAssignedImages = useMemo(
    () => form.productImages.reduce((sum, img) => sum + img.colors.length, 0),
    [form.productImages]
  );

  const uniqueSizes = useMemo(
    () => Array.from(new Set(form.variants.map((v) => String(v.size)).filter(Boolean))),
    [form.variants]
  );

  const canReview = form.variants.length > 0 &&
    form.variants.every((v) => v.color && v.size && v.sku && v.price);

  const syncImportedProductsWithDraft = (products = importedProducts, draft = form, draftImportId = activeImportId) => {
    if (!draftImportId) return products;
    return products.map((product) =>
      product.importId === draftImportId ? { ...product, ...cloneProductDraft(draft), importId: draftImportId } : product
    );
  };

  const getLatestImportedProducts = () => syncImportedProductsWithDraft();

  useEffect(() => {
    if (!activeImportId) return;
    setImportedProducts((prev) =>
      syncImportedProductsWithDraft(prev)
    );
  }, [form, activeImportId]);

  const patchForm    = (payload) => setForm((prev) => ({ ...prev, ...payload }));
  const patchVariant = (index, payload) =>
    setForm((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === index ? { ...v, ...payload } : v) }));
  const removeVariant = (index) =>
    setForm((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));

  const getGridDraft = (color, variants = []) => ({
    sizes: variants.map((v) => v.size).join(", "),
    price: "", compareAtPrice: "", quantity: "",
    ...(gridDrafts[color] || {}),
  });

  const patchGridDraft = (color, payload) =>
    setGridDrafts((prev) => ({
      ...prev,
      [color]: { ...getGridDraft(color, colorGroups[color] || {}), ...(prev[color] || {}), ...payload },
    }));

  const applySizesToColor = (color, sizes, defaults = {}) => {
    const unique   = Array.from(new Set(sizes.map((s) => String(s).trim()).filter(Boolean)));
    const colorKey = getColorKey(color);
    setForm((prev) => {
      const existing = prev.variants.filter((v) => getColorKey(v.color) === colorKey);
      const others   = prev.variants.filter((v) => getColorKey(v.color) !== colorKey);
      const next = unique.map((size) => {
        const found = existing.find((v) => String(v.size) === String(size));
        return found
          ? { ...found,
              price:          defaults.price          !== "" && defaults.price          !== undefined ? defaults.price          : found.price,
              compareAtPrice: defaults.compareAtPrice !== "" && defaults.compareAtPrice !== undefined ? defaults.compareAtPrice : found.compareAtPrice,
              quantity:       defaults.quantity       !== "" && defaults.quantity       !== undefined ? defaults.quantity       : found.quantity }
          : { ...emptyVariant(color, size, prev), price: defaults.price || "", compareAtPrice: defaults.compareAtPrice || "", quantity: defaults.quantity || "" };
      });
      return { ...prev, variants: [...others, ...next] };
    });
    patchGridDraft(color, { sizes: unique.join(", ") });
  };

  const addColorGroup = (colorValue = newColor) => {
    const color = colorValue.trim();
    if (!color) return;
    if (colorNames.some((c) => getColorKey(c) === getColorKey(color))) { setNewColor(""); return; }
    setForm((prev) => ({ ...prev, variants: [...prev.variants, emptyVariant(color, "9", prev)] }));
    setGridDrafts((prev) => ({ ...prev, [color]: { sizes: "9", price: "", compareAtPrice: "", quantity: "" } }));
    setNewColor("");
  };

  const renameColorGroup = (oldColor, nextColor) => {
    const color = nextColor.trim();
    if (!color || getColorKey(color) === getColorKey(oldColor)) return;
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        getColorKey(v.color) === getColorKey(oldColor)
          ? { ...v, color, sku: buildSku(prev.brand, prev.modelNumber, color, v.size) }
          : v
      ),
      productImages: prev.productImages.map((img) => ({
        ...img, colors: img.colors.map((c) => getColorKey(c) === getColorKey(oldColor) ? color : c),
      })),
    }));
    setGridDrafts((prev) => { const n = { ...prev, [color]: prev[oldColor] }; delete n[oldColor]; return n; });
  };

  const applyDefaultsToColor = (color) => {
    const draft = getGridDraft(color, colorGroups[color] || []);
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        getColorKey(v.color) === getColorKey(color)
          ? { ...v,
              price:          draft.price          !== "" ? draft.price          : v.price,
              compareAtPrice: draft.compareAtPrice !== "" ? draft.compareAtPrice : v.compareAtPrice,
              quantity:       draft.quantity       !== "" ? draft.quantity       : v.quantity }
          : v
      ),
    }));
  };

  const addProductImages = (files) => {
    const items = Array.from(files || []).map(createImageItem);
    if (!items.length) return;
    setForm((prev) => ({ ...prev, productImages: [...prev.productImages, ...items] }));
  };

  const removeProductImage = (id) => {
    const img = form.productImages.find((i) => i.id === id);
    if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
    setForm((prev) => ({ ...prev, productImages: prev.productImages.filter((i) => i.id !== id) }));
  };

  const toggleImageColor = (imageId, color) =>
    setForm((prev) => ({
      ...prev,
      productImages: prev.productImages.map((img) => {
        if (img.id !== imageId) return img;
        const has = img.colors.some((c) => getColorKey(c) === getColorKey(color));
        return { ...img, colors: has ? img.colors.filter((c) => getColorKey(c) !== getColorKey(color)) : [...img.colors, color] };
      }),
    }));

  const toggleImageAllColors = (imageId) =>
    setForm((prev) => ({
      ...prev,
      productImages: prev.productImages.map((img) => {
        if (img.id !== imageId) return img;
        const allSel = colorNames.every((c) => img.colors.some((ic) => getColorKey(ic) === getColorKey(c)));
        return { ...img, colors: allSel ? [] : colorNames };
      }),
    }));

  const getImagesForVariant = (variant) =>
    form.productImages.filter((img) => img.colors.some((c) => getColorKey(c) === getColorKey(variant.color)));

  const loadImportedProduct = (product, nextStep = step, productsSource = importedProducts) => {
    if (!product) return;
    const latestProducts = syncImportedProductsWithDraft(productsSource);
    const nextProduct = latestProducts.find((item) => item.importId === product.importId) || product;
    setImportedProducts(latestProducts);
    setActiveImportId(nextProduct.importId);
    setForm(cloneProductDraft(nextProduct));
    setGridDrafts({});
    setShortDescriptionTouched(Boolean(nextProduct.shortDescription));
    setStep(nextStep);
  };

  const buildProductFormData = (product, includeImages = true) => {
    const fd = new FormData();
    ["name","brand","modelNumber","category","gender","description","shortDescription","tags"].forEach(
      (k) => fd.append(k, product[k] || "")
    );
    fd.append("variants", JSON.stringify(product.variants.map((v) => ({
      color: v.color, size: v.size, sku: v.sku,
      price: Number(v.price || 0),
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
      quantity: Number(v.quantity || 0),
    }))));
    if (includeImages) {
      const colorImageGroups = [];
      (product.productImages || []).forEach((img, imageIndex) => {
        const colors = uniqColors(img.colors || []);
        if (!img.file || colors.length === 0) return;

        const fieldName = `colorImages_${imageIndex}`;
        fd.append(fieldName, img.file);
        colorImageGroups.push({ fieldName, colors });
      });
      fd.append("colorImageGroups", JSON.stringify(colorImageGroups));
    }
    return fd;
  };

  const generateAiContent = async (target = "all") => {
    setAiGeneratingTarget(target); setAiError(null);
    try {
      const payload = await apiFetch("/ai/product-content", {
        method: "POST",
        body: JSON.stringify({ name: form.name, brand: form.brand, modelNumber: form.modelNumber, category: form.category, gender: form.gender, tags: form.tags, description: form.description, shortDescription: form.shortDescription, colors: colorNames, sizes: uniqueSizes, target }),
      });
      setForm((prev) => ({
        ...prev,
        tags:             payload.tags?.length > 0 ? payload.tags.join(", ") : prev.tags,
        shortDescription: target === "tags" ? prev.shortDescription : payload.shortDescription || prev.shortDescription,
        description:      target === "tags" ? prev.description      : payload.description      || prev.description,
      }));
      if (target !== "tags" && payload.shortDescription) setShortDescriptionTouched(true);
    } catch (err) {
      setAiError(err.message || "Could not generate product content.");
    } finally {
      setAiGeneratingTarget(null);
    }
  };

  const publishProduct = async () => {
    const productIssues = getProductPublishIssues(form);
    if (productIssues.length > 0) {
      setPublishError(`Finish this product before publishing: ${productIssues.join("; ")}.`);
      return;
    }
    setPublishing(true); setPublishError(null);
    try {
      await apiFetch(`/admin/products`, { method: "POST", body: buildProductFormData(form, true) });
      setSuccess(true);
      setTimeout(() => router.replace("/products"), 1500);
    } catch {
      setPublishError("Failed to publish. Please check your inputs and try again.");
      setSuccess(false);
    } finally {
      setPublishing(false);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImportStatus("Reading file…"); setPublishError(null); setImportFailures([]); setBulkPublishReport(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows = [];
      if (ext === "csv" || file.type.includes("csv") || file.type.includes("text")) {
        rows = parseCsv(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      } else {
        throw new Error("Use a CSV, XLS, or XLSX file.");
      }
      const { products, failures } = rowsToProducts(rows);
      setImportFailures(failures);
      if (!products.length) throw new Error("No product rows found. Check the template columns.");
      loadImportedProduct(products[0], 1, products);
      const summary = summarizeImportedImages(products);
      setImportStatus(
        `${products.length} product${products.length === 1 ? "" : "s"} imported. ${failures.length > 0 ? `${failures.length} row${failures.length === 1 ? "" : "s"} skipped.` : ""} ${summary.pending > 0 ? `${summary.pending} image reference${summary.pending === 1 ? "" : "s"} waiting for files.` : "Ready to review."}`.replace(/\s+/g, " ").trim()
      );
    } catch (err) {
      setImportStatus(err.message || "Could not import that file.");
    }
  };

  const handleImportImages = (files) => {
    const nextFiles = Array.from(files || []);
    if (!nextFiles.length || !importedProducts.length) return;

    const latestProducts = getLatestImportedProducts();
    const nextProducts = latestProducts.map((product) => resolveImportedProductImages(product, nextFiles));
    const activeProduct = nextProducts.find((product) => product.importId === activeImportId) || null;
    const summary = summarizeImportedImages(nextProducts);

    setImportedProducts(nextProducts);
    if (activeProduct) setForm(cloneProductDraft(activeProduct));

    setImportStatus(
      summary.pending > 0
        ? `${summary.matched} image${summary.matched === 1 ? "" : "s"} matched. ${summary.pending} reference${summary.pending === 1 ? "" : "s"} still pending.`
        : `${summary.matched} imported image${summary.matched === 1 ? "" : "s"} matched across ${nextProducts.length} product${nextProducts.length === 1 ? "" : "s"}.`
    );
  };

  const publishImportedProducts = async () => {
    if (!importedProducts.length) return;
    const latestProducts = getLatestImportedProducts();
    const productsForPublish = latestProducts.map((product) => ({
      ...cloneProductDraft(product),
      publishStatus: "queued",
      publishError: null,
      publishedProductId: null,
    }));

    let report = createBulkPublishReport(productsForPublish.length);
    const commitReport = (nextReport) => {
      report = nextReport;
      setBulkPublishReport(nextReport);
    };
    const patchImportedProductStatus = (importId, payload) => {
      setImportedProducts((prev) =>
        prev.map((product) => product.importId === importId ? { ...product, ...payload } : product)
      );
    };

    setBulkPublishing(true); setPublishError(null);
    setImportedProducts(productsForPublish);
    setBulkPublishReport(report);
    setImportStatus(`Publishing ${productsForPublish.length} product${productsForPublish.length === 1 ? "" : "s"}…`);
    try {
      for (let index = 0; index < productsForPublish.length; index += 1) {
        const product = productsForPublish[index];
        const name = product.name || `Product ${index + 1}`;
        const issues = getProductPublishIssues(product);

        if (issues.length > 0) {
          const failure = { index, rowNumber: index + 1, name, message: issues.join("; ") };
          patchImportedProductStatus(product.importId, { publishStatus: "failed", publishError: failure.message });
          commitReport({
            ...report,
            processed: report.processed + 1,
            failed: report.failed + 1,
            currentName: "",
            failures: [...report.failures, failure],
          });
          continue;
        }

        patchImportedProductStatus(product.importId, { publishStatus: "publishing", publishError: null });
        commitReport({ ...report, currentName: name });

        try {
          const payload = await apiFetch(`/admin/products`, { method: "POST", body: buildProductFormData(product, true) });
          patchImportedProductStatus(product.importId, {
            publishStatus: "published",
            publishError: null,
            publishedProductId: payload.product?.id || null,
          });
          commitReport({
            ...report,
            processed: report.processed + 1,
            succeeded: report.succeeded + 1,
            currentName: "",
          });
        } catch (err) {
          const failure = {
            index,
            rowNumber: index + 1,
            name,
            message: err.message || "Product could not be created.",
          };
          patchImportedProductStatus(product.importId, { publishStatus: "failed", publishError: failure.message });
          commitReport({
            ...report,
            processed: report.processed + 1,
            failed: report.failed + 1,
            currentName: "",
            failures: [...report.failures, failure],
          });
        }
      }

      setImportStatus(
        `${report.succeeded} product${report.succeeded === 1 ? "" : "s"} created. ${report.failed > 0 ? `${report.failed} failed and are listed in the progress tracker.` : "All rows completed."}`
      );
      if (report.failed === 0) setTimeout(() => router.replace("/products"), 1200);
    } catch (err) {
      setPublishError(err.message || "Bulk publish failed. Check the imported rows and try again.");
    } finally {
      setBulkPublishing(false);
    }
  };

  /* ─── render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen pb-24">
      {/* sticky header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-app)]/90 backdrop-blur-sm px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Catalogue</p>
            <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">New Product</h1>
          </div>
        </div>

        {/* progress steps */}
        <StepIndicator step={step} onGoTo={setStep} />

        {/* thin progress bar */}
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <motion.div
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full rounded-full bg-[var(--highlight)]"
          />
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {importedProducts.length > 0 && (
          <ImportedProductWorkbench
            products={getLatestImportedProducts()}
            activeImportId={activeImportId}
            onSelectProduct={loadImportedProduct}
            onPublishAll={publishImportedProducts}
            bulkPublishing={bulkPublishing}
            bulkPublishReport={bulkPublishReport}
          />
        )}

        <AnimatePresence mode="wait">

          {/* ═══════════════ STEP 1 ═══════════════ */}
          {step === 1 && (
            <motion.section key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

              {/* import collapsible */}
              <div className="card-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setImportOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--highlight-soft)]">
                      <FileSpreadsheet size={16} className="text-[var(--highlight)]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Bulk Import</p>
                      <p className="text-[11px] text-[var(--text-muted)]">CSV, XLS, or XLSX</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-[var(--text-muted)] transition-transform ${importOpen ? "rotate-90" : ""}`} />
                </button>

                <AnimatePresence>
                  {importOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-[var(--border)]"
                    >
                      <div className="p-4 space-y-3">
                        <div className={`grid gap-2 ${importedProducts.length > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
                          <label className="app-button app-button-secondary flex h-11 cursor-pointer items-center justify-center gap-2 text-xs font-semibold">
                            <Upload size={14} />
                            Import File
                            <input type="file" className="hidden" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                          {importedProducts.length > 0 && (
                            <label className="app-button app-button-secondary flex h-11 cursor-pointer items-center justify-center gap-2 text-xs font-semibold">
                              <ImagePlus size={14} />
                              Match Images
                              <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => { handleImportImages(e.target.files); e.target.value = ""; }} />
                            </label>
                          )}
                          <a href={csvTemplateHref} download="product-import-template.csv" className="app-button app-button-secondary flex h-11 items-center justify-center gap-2 text-xs font-semibold">
                            <DownloadCloud size={14} />
                            Template
                          </a>
                        </div>

                        {importStatus && (
                          <p className={`text-xs ${importedProducts.length > 0 ? "text-[var(--success)]" : "text-[var(--text-secondary)]"}`}>
                            {importStatus}
                          </p>
                        )}

                        <FailureLog failures={importFailures} />

                        {importedProducts.length > 0 && (
                          <div className="rounded-[12px] bg-[var(--bg-app)] p-3">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{importedProducts.length} products imported</p>
                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                              {activeImportedProduct?.name || importedProducts[0].name} is loaded in Details
                              {importImageSummary.matched > 0 ? ` · ${importImageSummary.matched} images matched` : ""}
                              {importImageSummary.pending > 0 ? ` · ${importImageSummary.pending} pending refs` : ""}
                            </p>
                            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                              Use the Imported Products panel below to switch any product into Details, Variants, or Review before publishing all.
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* product details card */}
              <div className="card-surface p-4 space-y-5">

                {/* Name */}
                <FieldGroup label="Product Name">
                  <input
                    value={form.name}
                    onChange={(e) => patchForm({ name: e.target.value })}
                    className="form-input text-base"
                    placeholder="e.g. Velocity Pro"
                    autoComplete="off"
                  />
                </FieldGroup>

                {/* Brand + Model */}
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Brand">
                    <input value={form.brand} onChange={(e) => patchForm({ brand: e.target.value })} className="form-input" placeholder="e.g. AuraZone" />
                  </FieldGroup>
                  <FieldGroup label="Model No.">
                    <input value={form.modelNumber} onChange={(e) => patchForm({ modelNumber: e.target.value })} className="form-input" placeholder="VP-100" />
                  </FieldGroup>
                </div>

                {/* Category */}
                <FieldGroup label="Category">
                  <ToggleChips
                    options={categories}
                    value={form.category}
                    onChange={(v) => patchForm({ category: v })}
                    renderLabel={(opt) => <>{CATEGORY_ICONS[opt]} {opt.charAt(0) + opt.slice(1).toLowerCase()}</>}
                  />
                </FieldGroup>

                {/* Gender */}
                <FieldGroup label="Gender">
                  <ToggleChips
                    options={genders}
                    value={form.gender}
                    onChange={(v) => patchForm({ gender: v })}
                    renderLabel={(opt) => <>{GENDER_ICONS[opt]} {opt.charAt(0) + opt.slice(1).toLowerCase()}</>}
                  />
                </FieldGroup>

                {/* AI toolbar */}
                <AIToolbar
                  form={form}
                  colorNames={colorNames}
                  uniqueSizes={uniqueSizes}
                  aiGeneratingTarget={aiGeneratingTarget}
                  aiError={aiError}
                  onGenerate={generateAiContent}
                />

                {/* Description */}
                <FieldGroup label="Description">
                  <textarea
                    value={form.description}
                    onChange={(e) => patchForm({ description: e.target.value })}
                    className="form-textarea"
                    placeholder="Full product description…"
                    rows={4}
                  />
                </FieldGroup>

                {/* Short description */}
                <FieldGroup
                  label="Short Description"
                  action={
                    <button
                      type="button"
                      onClick={() => { setShortDescriptionTouched(false); patchForm({ shortDescription: generatedShortDescription }); }}
                      disabled={!generatedShortDescription}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[var(--highlight)] disabled:opacity-40"
                    >
                      <Wand2 size={11} /> Auto
                    </button>
                  }
                >
                  <input
                    value={form.shortDescription}
                    onChange={(e) => { setShortDescriptionTouched(true); patchForm({ shortDescription: e.target.value }); }}
                    className="form-input"
                    placeholder={generatedShortDescription || "One-line summary"}
                  />
                </FieldGroup>

                {/* Tags */}
                <FieldGroup label="Tags" hint="Separate with commas">
                  <input
                    value={form.tags}
                    onChange={(e) => patchForm({ tags: e.target.value })}
                    className="form-input"
                    placeholder="running, sport, comfort"
                  />
                  {form.tags && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {parseTags(form.tags).map((tag) => (
                        <span key={tag} className="rounded-full bg-[var(--highlight-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </FieldGroup>
              </div>

              {/* next CTA */}
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!form.name || !form.brand}
                className="app-button app-button-primary flex h-13 w-full items-center justify-center gap-2 rounded-[16px] text-sm font-semibold disabled:opacity-40"
              >
                Continue to Variants <ChevronRight size={16} />
              </button>
            </motion.section>
          )}

          {/* ═══════════════ STEP 2 ═══════════════ */}
          {step === 2 && (
            <motion.section key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

              {/* add color */}
              <div className="card-surface p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--highlight-soft)]">
                    <Palette size={16} className="text-[var(--highlight)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Colors & Sizes</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Add a color, pick sizes, set pricing</p>
                  </div>
                </div>

                {/* common color quick-add */}
                <div className="flex flex-wrap gap-1.5">
                  {commonColors.map((color) => {
                    const added = colorNames.some((c) => getColorKey(c) === getColorKey(color));
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => !added && addColorGroup(color)}
                        disabled={added}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                          added
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] opacity-60 cursor-default"
                            : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <ColorSwatch color={color} size={8} />
                        {color}
                        {added && <Check size={9} />}
                      </button>
                    );
                  })}
                </div>

                {/* custom color */}
                <div className="flex gap-2">
                  <input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColorGroup(); }}}
                    className="form-input flex-1 text-sm"
                    placeholder="Custom color name…"
                  />
                  <button
                    type="button"
                    onClick={() => addColorGroup()}
                    disabled={!newColor.trim()}
                    className="app-button app-button-primary flex h-10 w-10 items-center justify-center rounded-[12px] disabled:opacity-40"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* variant grids */}
              {Object.entries(colorGroups).map(([color, variants]) => (
                <VariantGrid
                  key={color}
                  color={color}
                  variants={variants}
                  draft={getGridDraft(color, variants)}
                  suggestedSizes={suggestedSizes}
                  selectedSizes={variants.map((v) => String(v.size))}
                  onPatchDraft={patchGridDraft}
                  onApplySizes={applySizesToColor}
                  onApplyDefaults={applyDefaultsToColor}
                  onPatchVariant={patchVariant}
                  onRemoveVariant={removeVariant}
                  onRenameColor={renameColorGroup}
                  form={form}
                />
              ))}

              {/* image pool */}
              <div className="card-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--highlight-soft)]">
                      <ImageIcon size={16} className="text-[var(--highlight)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Image Pool</p>
                      <p className="text-[11px] text-[var(--text-muted)]">Upload once, assign to colors</p>
                    </div>
                  </div>
                  {form.productImages.length > 0 && (
                    <span className="rounded-full bg-[var(--highlight-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--highlight)]">
                      {form.productImages.length} photo{form.productImages.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {form.pendingImageRefs?.length > 0 && (
                  <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Imported image refs pending</p>
                    <p className="mt-1 text-[11px] text-amber-700">
                      Match these filenames from the Bulk Import panel, or upload and assign them manually here.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {form.pendingImageRefs.map((ref) => (
                        <span key={ref.id} className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-amber-700 shadow-sm">
                          {ref.reference}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <ImagePool
                  form={form}
                  colorNames={colorNames}
                  onAdd={addProductImages}
                  onRemove={removeProductImage}
                  onToggleColor={toggleImageColor}
                  onToggleAll={toggleImageAllColors}
                />
              </div>

              {/* nav */}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="app-button app-button-secondary flex h-13 flex-1 items-center justify-center gap-2 rounded-[16px] text-sm font-semibold">
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canReview}
                  className="app-button app-button-primary flex h-13 flex-1 items-center justify-center gap-2 rounded-[16px] text-sm font-semibold disabled:opacity-40"
                >
                  Review <ChevronRight size={16} />
                </button>
              </div>
            </motion.section>
          )}

          {/* ═══════════════ STEP 3 ═══════════════ */}
          {step === 3 && (
            <motion.section key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

              {/* product summary */}
              <div className="card-surface p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[var(--highlight-soft)] text-2xl">
                    {CATEGORY_ICONS[form.category]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-[var(--text-primary)] leading-tight">{form.name || "Untitled"}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{form.brand}{form.modelNumber ? ` · ${form.modelNumber}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-semibold text-white">{form.category}</span>
                      <span className="inline-flex items-center rounded-full bg-[var(--highlight)] px-2.5 py-0.5 text-[10px] font-semibold text-white">{form.gender}</span>
                    </div>
                  </div>
                </div>

                {form.shortDescription && (
                  <p className="text-sm text-[var(--text-primary)] border-t border-[var(--border)] pt-3">{form.shortDescription}</p>
                )}
                {form.description && (
                  <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{form.description}</p>
                )}
                {form.tags && (
                  <div className="flex flex-wrap gap-1.5">
                    {parseTags(form.tags).map((tag) => (
                      <span key={tag} className="rounded-full bg-[var(--highlight-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)]">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Variants", value: form.variants.length },
                  { label: "Photos",   value: form.productImages.length },
                  { label: "Assigned", value: totalAssignedImages },
                ].map(({ label, value }) => (
                  <div key={label} className="card-surface flex flex-col items-center justify-center py-3 text-center">
                    <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
                  </div>
                ))}
              </div>

              {/* variant review */}
              <div className="card-surface p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Variants</p>
                {form.variants.map((variant, index) => {
                  const assignedImages = getImagesForVariant(variant);
                  return (
                    <div key={index} className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] p-3">
                      <ColorSwatch color={variant.color} size={14} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{variant.color} · Size {variant.size}</p>
                        <p className="text-[11px] font-mono text-[var(--text-muted)]">{variant.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[var(--text-primary)]">₹{variant.price || 0}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">Stock: {variant.quantity || 0}</p>
                      </div>
                      {assignedImages.length > 0 && (
                        <div className="flex -space-x-2 shrink-0">
                          {assignedImages.slice(0, 3).map((img) => (
                            <div key={img.id} className="h-8 w-8 overflow-hidden rounded-full border-2 border-[var(--bg-app)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                            </div>
                          ))}
                          {assignedImages.length > 3 && (
                            <div className="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--bg-app)] bg-[var(--border)] text-[10px] font-bold text-[var(--text-secondary)]">
                              +{assignedImages.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {publishError && (
                <div className="error-banner flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{publishError}</span>
                </div>
              )}

              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="success-banner flex items-center gap-3"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
                      <Check size={16} />
                    </div>
                    <div>
                      <p className="font-semibold">Product published!</p>
                      <p className="text-xs opacity-75">Redirecting to products…</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* nav */}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="app-button app-button-secondary flex h-13 items-center justify-center gap-2 rounded-[16px] px-5 text-sm font-semibold">
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={publishProduct}
                  className="app-button flex h-13 flex-1 items-center justify-center gap-2 rounded-[16px] bg-[var(--highlight)] text-sm font-semibold text-white disabled:opacity-50"
                >
                  {publishing
                    ? <><span className="brand-spinner h-4 w-4 rounded-full border-2 border-white border-t-transparent" /> Publishing…</>
                    : <><Sparkles size={16} /> Publish Product</>
                  }
                </button>
              </div>
            </motion.section>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
