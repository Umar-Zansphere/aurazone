'use client';

import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useCartStore from '@/store/cartStore';
import Sidebar from './Sidebar';

export default function Header({
  onSidebarOpen,
  onCartOpen,
  onSearch,
  user
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

    // Use cart store for cart count
  const { items: cartItems, fetchCart, getCartCount } = useCartStore();
  const cartCount = getCartCount();

  // Calculate cart count - from API or localStorage
  useEffect(() => {
    fetchCart(); // Fetch cart from API on mount to sync with server
  }, [fetchCart]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to products page with search query
      router.push(`/products?search=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSidebarOpen = () => {
    if (onSidebarOpen) {
      // If parent component provides handler, use it
      onSidebarOpen();
    } else {
      // Otherwise, use internal state
      setSidebarOpen(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200/60 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between">
          {/* Left: Menu & Logo */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={handleSidebarOpen}
              className="p-2.5 -ml-2 hover:bg-gray-100 rounded-xl transition-all duration-200 text-slate-900 active:scale-95 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu strokeWidth={2} size={24} />
            </button>
            <a
              href="/"
              className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900 hover:opacity-80 transition-opacity"
            >
              SoleMate<span className="text-orange-500 text-2xl sm:text-3xl leading-none">.</span>
            </a>
          </div>

          {/* Center: Search (Mobile optimized) */}
          {searchOpen && (
            <form
              onSubmit={handleSearch}
              className="absolute left-0 right-0 top-full bg-white border-b border-gray-200 p-4 shadow-lg animate-in slide-in-from-top-2 duration-200"
            >
              <div className="max-w-7xl mx-auto flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search shoes by name, brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                />
                <button
                  type="submit"
                  className="px-4 sm:px-6 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors active:scale-95 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Search"
                >
                  <Search size={20} />
                </button>
              </div>
            </form>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 text-slate-900 active:scale-95 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={searchOpen ? "Close search" : "Open search"}
            >
              {searchOpen ? <X strokeWidth={2} size={22} /> : <Search strokeWidth={2} size={22} />}
            </button>
            <button
              onClick={() => router.push('/cart')}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 text-slate-900 relative active:scale-95 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Shopping cart"
            >
              <ShoppingBag strokeWidth={2} size={22} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white shadow-lg animate-in zoom-in-50 duration-200">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Internal Sidebar - only rendered if parent doesn't provide onSidebarOpen */}
      {!onSidebarOpen && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
        />
      )}
    </>
  );
}