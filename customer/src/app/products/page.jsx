'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ChevronDown, X, Package } from 'lucide-react';
import Header from '@/app/components/Header';
import ProductCard from '@/app/components/ProductCard';
import { productApi, cartApi, wishlistApi } from '@/lib/api';

const getFiltersFromParams = (params) => ({
  category: params.get('category') || '',
  gender: params.get('gender') || '',
  brand: params.get('brand') || '',
  color: params.get('color') || '',
  size: params.get('size') || '',
  minPrice: params.get('minPrice') || '',
  maxPrice: params.get('maxPrice') || '',
});

const getEmptyFilters = () => ({
  category: '',
  gender: '',
  brand: '',
  color: '',
  size: '',
  minPrice: '',
  maxPrice: '',
});

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState([]);
  const [filterOptions, setFilterOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [user, setUser] = useState(null);

  // Filter states
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [draftFilters, setDraftFilters] = useState(() => getFiltersFromParams(searchParams));
  const [filters, setFilters] = useState(() => getFiltersFromParams(searchParams));
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'popular');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Pagination
  const itemsPerPage = 12;

  // Sync filters with searchParams when URL changes (e.g., from sidebar navigation)
  useEffect(() => {
    const nextFilters = getFiltersFromParams(searchParams);
    const nextSearch = searchParams.get('search') || '';
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setSearchInput(nextSearch);
    setSearchTerm(nextSearch);
    setSortBy(searchParams.get('sort') || 'popular');
    setCurrentPage(parseInt(searchParams.get('page') || '1'));
  }, [searchParams]);

  // Load filters and products
  useEffect(() => {
    loadFilterOptions();
    loadProducts();
    loadWishlist();
  }, [filters, searchTerm, sortBy, currentPage]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const data = await productApi.getFilterOptions();
      setFilterOptions(data.data || data);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        skip: (currentPage - 1) * itemsPerPage,
        take: itemsPerPage,
      };

      if (searchTerm) params.search = searchTerm;
      if (filters.category) params.category = filters.category;
      if (filters.gender) params.gender = filters.gender;
      if (filters.brand) params.brand = filters.brand;
      if (filters.color) params.color = filters.color;
      if (filters.size) params.size = filters.size;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;

      let data;
      const hasDetailedFilters = filters.category || filters.gender || filters.brand ||
        filters.color || filters.size || filters.minPrice || filters.maxPrice;

      if (searchTerm || hasDetailedFilters) {
        data = await productApi.searchProducts(params);
      } else {
        data = await productApi.getProducts(params);
      }

      let productsData = Array.isArray(data)
        ? data
        : (data?.data?.products || data?.products || data?.data || []);

      // Sort products
      if (sortBy === 'price-low') {
        productsData = productsData.sort((a, b) => {
          const priceA = a.variants?.[0]?.price || a.price || 0;
          const priceB = b.variants?.[0]?.price || b.price || 0;
          return priceA - priceB;
        });
      } else if (sortBy === 'price-high') {
        productsData = productsData.sort((a, b) => {
          const priceA = a.variants?.[0]?.price || a.price || 0;
          const priceB = b.variants?.[0]?.price || b.price || 0;
          return priceB - priceA;
        });
      } else if (sortBy === 'newest') {
        productsData = productsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      setProducts(productsData);
    } catch (err) {
      console.error('Failed to load products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, sortBy, currentPage]);

  const loadWishlist = useCallback(async () => {
    try {
      // Try to fetch from API first (uses cookies)
      try {
        const data = await wishlistApi.getWishlist();
        const items = data.items || [];
        setWishlist(items.map(item => `${item.productId}-${item.variantId}`));
        return;
      } catch (apiError) {
        // If API fails (user not authenticated), fall back to localStorage
        const items = storageApi.getWishlist();
        setWishlist(items.map(item => `${item.productId}-${item.variantId}`));
      }
    } catch (err) {
      console.error('Failed to load wishlist:', err);
    }
  }, []);

  const updateUrl = useCallback(({
    nextFilters = filters,
    nextSearch = searchTerm,
    nextSort = sortBy,
    nextPage = currentPage,
  } = {}) => {
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (nextSearch) params.set('search', nextSearch);
    if (nextSort !== 'popular') params.set('sort', nextSort);
    if (nextPage > 1) params.set('page', nextPage);

    const query = params.toString();
    router.push(query ? `/products?${query}` : '/products');
  }, [router, filters, searchTerm, sortBy, currentPage]);

  const handleFilterChange = (field, value) => {
    setDraftFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleRemoveFilter = (field) => {
    const nextFilters = { ...filters, [field]: '' };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setCurrentPage(1);
    updateUrl({ nextFilters, nextPage: 1 });
  };

  const handleApplyFilters = () => {
    setFilters(draftFilters);
    setCurrentPage(1);
    updateUrl({ nextFilters: draftFilters, nextPage: 1 });
    setSidebarOpen(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const nextSearch = searchInput.trim();
    setSearchTerm(nextSearch);
    setCurrentPage(1);
    updateUrl({ nextSearch, nextPage: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setCurrentPage(1);
    updateUrl({ nextSearch: '', nextPage: 1 });
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    updateUrl({ nextPage: page });
  };

  const handleAddToCart = async (item) => {
    try {
      // Try API first (uses cookies)
      try {
        await cartApi.addToCart(item.variantId, item.quantity);
      } catch (apiError) {
        // If API fails (user not authenticated), use localStorage
        storageApi.addToCart({
          id: `${item.productId}-${item.variantId}`,
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
        });
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleToggleWishlist = async (item) => {
    try {
      const itemKey = `${item.productId}-${item.variantId}`;

      if (wishlist.includes(itemKey)) {
        // Remove from wishlist
        try {
          const wishlistItem = (await wishlistApi.getWishlist()).items?.find(
            w => w.productId === item.productId && w.variantId === item.variantId
          );
          if (wishlistItem) {
            await wishlistApi.removeFromWishlist(wishlistItem.id);
          }
        } catch (apiError) {
          // If API fails, just remove from localStorage
          storageApi.removeFromWishlist(itemKey);
        }
        setWishlist(prev => prev.filter(id => id !== itemKey));
      } else {
        // Add to wishlist
        try {
          await wishlistApi.addToWishlist(item.productId, item.variantId);
        } catch (apiError) {
          // If API fails, add to localStorage
          storageApi.addToWishlist({
            productId: item.productId,
            variantId: item.variantId,
          });
        }
        setWishlist(prev => [...prev, itemKey]);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  const activeFilters = Object.entries(filters).filter(([_, value]) => value);
  const hasActiveFilters = activeFilters.length > 0 || searchTerm;
  const hasPendingFilterChanges = Object.keys(filters).some((key) => filters[key] !== draftFilters[key]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full px-4 py-3 pl-12 pr-12 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        <div className="flex gap-8 relative">
          {/* Mobile Backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 lg:hidden z-30"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar Filters */}
          <aside className={`fixed inset-y-0 left-0 z-70 w-72 bg-white shadow-xl transform transition-transform duration-300 lg:relative lg:inset-auto lg:z-auto lg:w-64 lg:shadow-none lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
            <div className="h-full overflow-y-auto p-6 sticky top-0">
              {/* Close Button for Mobile */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden mb-6 p-2 hover:bg-gray-100 rounded-lg transition-colors absolute top-4 right-4"
                aria-label="Close filters"
              >
                <X size={24} />
              </button>

              <div className="flex items-center justify-between mb-6 mt-8 lg:mt-0">
                <h3 className="text-lg font-bold text-slate-900">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      const clearedFilters = getEmptyFilters();
                      setDraftFilters(clearedFilters);
                      setFilters(clearedFilters);
                      setSearchInput('');
                      setSearchTerm('');
                      setCurrentPage(1);
                      updateUrl({
                        nextFilters: clearedFilters,
                        nextSearch: '',
                        nextPage: 1,
                      });
                    }}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Category Filter */}
              {filterOptions?.categories && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Category</h4>
                  <div className="space-y-2">
                    {filterOptions.categories.map(cat => (
                      <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="category"
                          value={cat}
                          checked={draftFilters.category === cat}
                          onChange={(e) => handleFilterChange('category', e.target.value)}
                          className="w-4 h-4 accent-orange-600"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Gender Filter */}
              {filterOptions?.genders && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Gender</h4>
                  <div className="space-y-2">
                    {filterOptions.genders.map(gender => (
                      <label key={gender} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="gender"
                          value={gender}
                          checked={draftFilters.gender === gender}
                          onChange={(e) => handleFilterChange('gender', e.target.value)}
                          className="w-4 h-4 accent-orange-600"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{gender}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Filter */}
              {filterOptions?.brands && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Brand</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filterOptions.brands.map(brand => (
                      <label key={brand} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="brand"
                          value={brand}
                          checked={draftFilters.brand === brand}
                          onChange={(e) => handleFilterChange('brand', e.target.value)}
                          className="w-4 h-4 accent-orange-600"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{brand}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Filter */}
              {filterOptions?.colors && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Color</h4>
                  <div className="space-y-2">
                    {filterOptions.colors.map(color => (
                      <label key={color} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="color"
                          value={color}
                          checked={draftFilters.color === color}
                          onChange={(e) => handleFilterChange('color', e.target.value)}
                          className="w-4 h-4 accent-orange-600"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{color}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Filter */}
              {filterOptions?.sizes && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Size</h4>
                  <div className="space-y-2">
                    {filterOptions.sizes.map(size => (
                      <label key={size} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="size"
                          value={size}
                          checked={draftFilters.size === size}
                          onChange={(e) => handleFilterChange('size', e.target.value)}
                          className="w-4 h-4 accent-orange-600"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{size}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Filter */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Price Range</h4>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={draftFilters.minPrice}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={draftFilters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <button
                  onClick={handleApplyFilters}
                  disabled={!hasPendingFilterChanges}
                  className="w-full mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-600 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-black text-slate-900">Products</h1>
                <p className="text-gray-600 mt-1">
                  {loading ? 'Loading...' : `${products.length} products found`}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const nextSort = e.target.value;
                    setSortBy(nextSort);
                    setCurrentPage(1);
                    updateUrl({ nextSort, nextPage: 1 });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="popular">Most Popular</option>
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>

                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold"
                >
                  Filters
                </button>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="mb-6 flex flex-wrap gap-2">
                {searchTerm && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    Search: {searchTerm}
                    <button onClick={handleClearSearch} className="ml-1">
                      <X size={14} />
                    </button>
                  </div>
                )}
                {activeFilters.map(([key, value]) => (
                  <div key={key} className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    {key}: {value}
                    <button onClick={() => handleRemoveFilter(key)} className="ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Products Grid */}
            {loading ? (
              <div className="flex justify-center items-center min-h-96">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-600"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <Package size={64} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">Try adjusting your filters or search term</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
                  {products.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isLiked={wishlist.includes(`${product.id}-${product.variants?.[0]?.id}`)}
                      onToggleLike={(item) => handleToggleWishlist(item)}
                      onAddToCart={(item) => handleAddToCart(item)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center gap-2 py-8">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {[...Array(Math.ceil(products.length / itemsPerPage) || 1)].map((_, i) => {
                      const page = i + 1;
                      if (page === 1 || page === Math.ceil(products.length / itemsPerPage) || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`w-10 h-10 rounded-lg font-semibold ${page === currentPage
                              ? 'bg-orange-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={products.length < itemsPerPage}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-600"></div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
