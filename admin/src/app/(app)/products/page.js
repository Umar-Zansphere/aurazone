"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Filter, Plus, Search, Star, ToggleRight, Trash2, PackageX,
  ShoppingBag, Sparkles, CheckCircle2, AlertTriangle, AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
import ProductCard from "@/components/products/product-card";
import EmptyState from "@/components/ui/empty-state";
import { useEmptyState } from "@/hooks/use-empty-state";
import { apiFetch } from "@/lib/api";

const categories = ["RUNNING", "CASUAL", "FORMAL", "SNEAKERS"];
const genders = ["MEN", "WOMEN", "UNISEX", "KIDS"];
const sortOptions = [
  { label: "Newest", value: "newest" },
  { label: "Price ↑", value: "price_asc" },
  { label: "Price ↓", value: "price_desc" },
];

export default function ProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuProduct, setMenuProduct] = useState(null);

  const [filters, setFilters] = useState({
    category: "",
    gender: "",
    isActive: "",
    isFeatured: "",
    sort: "newest",
  });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/admin/products", {
        params: {
          search,
          category: filters.category,
          gender: filters.gender,
          isActive: filters.isActive,
          isFeatured: filters.isFeatured,
          sort: filters.sort,
          take: 100,
        },
      });

      setProducts(data.products || []);
    } catch (err) {
      setError(err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.gender, filters.isActive, filters.isFeatured, filters.sort, search]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const patchProduct = async (product, payload) => {
    try {
      await apiFetch(`/admin/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, ...payload } : item))
      );
    } catch {
      // silent
    }
    setMenuProduct(null);
  };

  const deleteProduct = async (product) => {
    try {
      await apiFetch(`/admin/products/${product.id}`, {
        method: "DELETE",
      });

      setProducts((current) => current.filter((item) => item.id !== product.id));
    } catch {
      // silent
    }
    setMenuProduct(null);
  };

  const listState = useEmptyState(loading, products, error);

  // Overview stats
  const overview = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isActive).length;
    const featured = products.filter((p) => p.isFeatured).length;
    const outOfStock = products.filter((p) => {
      const qty = (p.variants || []).reduce((sum, v) => sum + (v.inventory?.quantity || 0), 0);
      return qty <= 0;
    }).length;
    const lowStock = products.filter((p) => {
      const qty = (p.variants || []).reduce((sum, v) => sum + (v.inventory?.quantity || 0), 0);
      return qty > 0 && qty < 10;
    }).length;
    return { total, active, featured, outOfStock, lowStock };
  }, [products]);

  return (
    <div className="pb-6">
      <header className="mb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="page-label">Catalog</p>
            <h1 className="page-title">Products</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="app-button app-button-secondary flex h-9 items-center gap-1.5 px-3 text-xs"
            >
              <Filter size={14} /> Filter
            </button>
            <button
              type="button"
              onClick={() => router.push("/products/new")}
              className="app-button app-button-primary flex h-9 items-center gap-1.5 px-3 text-xs"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="mt-3 flex h-11 items-center rounded-[14px] border border-[var(--border)] bg-white px-3 transition-all focus-within:border-[var(--highlight)] focus-within:ring-2 focus-within:ring-[var(--highlight-soft)]">
          <Search size={15} className="text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
      </header>

      {/* Overview Dashboard */}
      {!loading && products.length > 0 && (
        <section className="card-surface p-4 mb-4">
          <p className="section-title mb-3">Overview</p>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-[14px] bg-[var(--bg-app)] p-2.5 text-center">
              <ShoppingBag size={16} className="mx-auto text-[var(--text-muted)]" />
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{overview.total}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Total</p>
            </div>
            <div className="rounded-[14px] bg-[var(--bg-app)] p-2.5 text-center">
              <CheckCircle2 size={16} className="mx-auto text-[var(--success)]" />
              <p className="mt-1 text-lg font-bold text-[var(--success)]">{overview.active}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Active</p>
            </div>
            <div className="rounded-[14px] bg-[var(--bg-app)] p-2.5 text-center">
              <Sparkles size={16} className="mx-auto text-[var(--highlight)]" />
              <p className="mt-1 text-lg font-bold text-[var(--highlight)]">{overview.featured}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Featured</p>
            </div>
          </div>

          {(overview.lowStock > 0 || overview.outOfStock > 0) && (
            <div className="mt-2.5 flex gap-2">
              {overview.lowStock > 0 && (
                <div className="flex flex-1 items-center gap-2 rounded-[14px] border border-[rgba(183,121,31,0.2)] bg-[rgba(183,121,31,0.04)] p-2.5">
                  <AlertTriangle size={14} className="shrink-0 text-[var(--warning)]" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--warning)]">{overview.lowStock}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Low Stock</p>
                  </div>
                </div>
              )}
              {overview.outOfStock > 0 && (
                <div className="flex flex-1 items-center gap-2 rounded-[14px] border border-[rgba(155,44,44,0.2)] bg-[rgba(155,44,44,0.04)] p-2.5">
                  <AlertCircle size={14} className="shrink-0 text-[var(--error)]" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--error)]">{overview.outOfStock}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Out of Stock</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {listState.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="skeleton h-56 rounded-[20px]" />
          <div className="skeleton h-64 rounded-[20px]" />
          <div className="skeleton h-64 rounded-[20px]" />
          <div className="skeleton h-56 rounded-[20px]" />
        </div>
      ) : listState.showError ? (
        <div className="pt-4">
          <EmptyState
            title="Failed to load products"
            description="Something went wrong. Please try again."
            icon={PackageX}
            variant="error"
            action={{ label: "Retry", onClick: loadProducts }}
          />
        </div>
      ) : listState.showEmpty ? (
        <div className="pt-4">
          <EmptyState
            title="No products found"
            description={search ? "Try adjusting your search or filters." : "Add your first product to get started."}
            icon={PackageX}
            action={!search ? { label: "Add Product", onClick: () => router.push("/products/new") } : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={(item) => router.push(`/products/${item.id}`)}
              onLongPress={(item) => setMenuProduct(item)}
            />
          ))}
        </div>
      )}

      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter Products" snap="full">
        <div className="space-y-5 pb-3">
          <div>
            <p className="form-label">Category</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, category: "" }))}
                className={`app-chip rounded-full px-3 py-1.5 text-xs ${!filters.category ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-app)] text-[var(--text-secondary)]"
                  }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, category }))}
                  className={`app-chip rounded-full px-3 py-1.5 text-xs ${filters.category === category
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-app)] text-[var(--text-secondary)]"
                    }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="form-label">Gender</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, gender: "" }))}
                className={`app-chip rounded-full px-3 py-1.5 text-xs ${!filters.gender ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-app)] text-[var(--text-secondary)]"
                  }`}
              >
                All
              </button>
              {genders.map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, gender }))}
                  className={`app-chip rounded-full px-3 py-1.5 text-xs ${filters.gender === gender
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-app)] text-[var(--text-secondary)]"
                    }`}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, isActive: prev.isActive === "true" ? "" : "true" }))}
              className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] px-3 py-3 text-sm transition-colors hover:bg-[var(--surface-hover)]"
            >
              Active only
              <span className={`toggle-track`} data-active={String(filters.isActive === "true")}>
                <span className="toggle-thumb" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, isFeatured: prev.isFeatured === "true" ? "" : "true" }))}
              className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] px-3 py-3 text-sm transition-colors hover:bg-[var(--surface-hover)]"
            >
              Featured only
              <span className={`toggle-track`} data-active={String(filters.isFeatured === "true")}>
                <span className="toggle-thumb" />
              </span>
            </button>
          </div>

          <div>
            <p className="form-label">Sort</p>
            <div className="space-y-2">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, sort: option.value }))}
                  className={`w-full rounded-[14px] border px-3 py-3 text-left text-sm transition-colors ${filters.sort === option.value
                    ? "border-[var(--highlight)] bg-[var(--highlight-soft)]"
                    : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="app-button app-button-primary h-11 w-full text-sm"
          >
            Apply Filters
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={Boolean(menuProduct)} onClose={() => setMenuProduct(null)} title={menuProduct?.name || "Product"} snap="half">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              if (!menuProduct) return;
              router.push(`/products/${menuProduct.id}`);
            }}
            className="w-full rounded-[14px] border border-[var(--border)] px-3 py-3 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
          >
            Edit Product
          </button>
          <button
            type="button"
            onClick={() => menuProduct && patchProduct(menuProduct, { isActive: !menuProduct.isActive })}
            className="flex w-full items-center gap-2 rounded-[14px] border border-[var(--border)] px-3 py-3 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
          >
            <ToggleRight size={16} />
            Toggle Active
          </button>
          <button
            type="button"
            onClick={() => menuProduct && patchProduct(menuProduct, { isFeatured: !menuProduct.isFeatured })}
            className="flex w-full items-center gap-2 rounded-[14px] border border-[var(--border)] px-3 py-3 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
          >
            <Star size={16} />
            Toggle Featured
          </button>
          <button
            type="button"
            onClick={() => menuProduct && deleteProduct(menuProduct)}
            className="app-button-danger flex w-full items-center gap-2 rounded-[14px] px-3 py-3 text-left text-sm"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
