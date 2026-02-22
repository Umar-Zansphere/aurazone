"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Plus, Search, Star, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
import ProductCard from "@/components/products/product-card";
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
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.gender, filters.isActive, filters.isFeatured, filters.sort, search]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selectedSort = useMemo(
    () => sortOptions.find((item) => item.value === filters.sort) || sortOptions[0],
    [filters.sort]
  );

  const patchProduct = async (product, payload) => {
    await apiFetch(`/admin/products/${product.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, ...payload } : item))
    );
    setMenuProduct(null);
  };

  const deleteProduct = async (product) => {
    await apiFetch(`/admin/products/${product.id}`, {
      method: "DELETE",
    });

    setProducts((current) => current.filter((item) => item.id !== product.id));
    setMenuProduct(null);
  };

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-20 bg-[var(--bg-app)]/95 pb-3 pt-1 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Catalog</p>
            <h1 className="text-[28px] font-semibold text-[var(--accent)]">Products</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push("/products/new")}
            className="app-button grid h-11 w-11 place-items-center rounded-2xl bg-[var(--highlight)] text-white"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <div className="flex h-11 flex-1 items-center rounded-2xl border border-[var(--card-border)] bg-white px-3">
            <Search size={16} className="text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="app-button inline-flex h-11 items-center gap-1 rounded-2xl border border-[var(--card-border)] bg-white px-3 text-sm"
          >
            <Filter size={14} />
            {selectedSort.label}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-56 rounded-[20px]" />
          <div className="skeleton h-64 rounded-[20px]" />
          <div className="skeleton h-64 rounded-[20px]" />
          <div className="skeleton h-56 rounded-[20px]" />
        </div>
      ) : (
        <div className="columns-2 gap-3 [column-fill:_balance]">
          {products.map((product) => (
            <div key={product.id} className="mb-3 break-inside-avoid">
              <ProductCard
                product={product}
                onOpen={(item) => router.push(`/products/${item.id}`)}
                onLongPress={(item) => setMenuProduct(item)}
              />
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter Products" snap="full">
        <div className="space-y-5 px-1 pb-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Category</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, category: "" }))}
                className={`app-chip rounded-full px-3 py-1.5 text-xs ${
                  !filters.category ? "bg-[var(--accent)] text-white" : "bg-zinc-100 text-[var(--text-secondary)]"
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, category }))}
                  className={`app-chip rounded-full px-3 py-1.5 text-xs ${
                    filters.category === category
                      ? "bg-[var(--accent)] text-white"
                      : "bg-zinc-100 text-[var(--text-secondary)]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Gender</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, gender: "" }))}
                className={`app-chip rounded-full px-3 py-1.5 text-xs ${
                  !filters.gender ? "bg-[var(--accent)] text-white" : "bg-zinc-100 text-[var(--text-secondary)]"
                }`}
              >
                All
              </button>
              {genders.map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, gender }))}
                  className={`app-chip rounded-full px-3 py-1.5 text-xs ${
                    filters.gender === gender
                      ? "bg-[var(--accent)] text-white"
                      : "bg-zinc-100 text-[var(--text-secondary)]"
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
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--card-border)] px-3 py-3 text-sm"
            >
              Active only
              {filters.isActive === "true" ? <ToggleRight className="text-[var(--accent)]" /> : <ToggleLeft />}
            </button>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, isFeatured: prev.isFeatured === "true" ? "" : "true" }))}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--card-border)] px-3 py-3 text-sm"
            >
              Featured only
              {filters.isFeatured === "true" ? <ToggleRight className="text-[var(--accent)]" /> : <ToggleLeft />}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Sort</p>
            <div className="space-y-2">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, sort: option.value }))}
                  className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${
                    filters.sort === option.value
                      ? "border-[var(--accent)] bg-[color:rgba(27,42,74,0.05)]"
                      : "border-[var(--card-border)]"
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
            className="app-button h-11 w-full rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white"
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
            className="w-full rounded-2xl border border-[var(--card-border)] px-3 py-3 text-left text-sm"
          >
            Edit Product
          </button>
          <button
            type="button"
            onClick={() => menuProduct && patchProduct(menuProduct, { isActive: !menuProduct.isActive })}
            className="flex w-full items-center gap-2 rounded-2xl border border-[var(--card-border)] px-3 py-3 text-left text-sm"
          >
            <ToggleRight size={16} />
            Toggle Active
          </button>
          <button
            type="button"
            onClick={() => menuProduct && patchProduct(menuProduct, { isFeatured: !menuProduct.isFeatured })}
            className="flex w-full items-center gap-2 rounded-2xl border border-[var(--card-border)] px-3 py-3 text-left text-sm"
          >
            <Star size={16} />
            Toggle Featured
          </button>
          <button
            type="button"
            onClick={() => menuProduct && deleteProduct(menuProduct)}
            className="flex w-full items-center gap-2 rounded-2xl border border-[color:rgba(196,91,91,0.4)] px-3 py-3 text-left text-sm text-[var(--error)]"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
