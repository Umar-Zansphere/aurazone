'use client';

import { Menu, Search, ShoppingBag, X, User, ChevronDown, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import useCartStore from '@/store/cartStore';
import { BOTTOM_NAV_ITEMS } from '@/components/BottomNav';
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser, isAuthenticated, logout: authLogout } = useAuth();

  // Use cart store for cart count
  const { fetchCart, getCartCount } = useCartStore();
  const cartCount = getCartCount();
  const resolvedUser = user || authUser;

  // Calculate cart count - from API or localStorage
  useEffect(() => {
    fetchCart(); // Fetch cart from API on mount to sync with server
  }, [fetchCart]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

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

  const handleProfileNavigate = (href) => {
    setProfileMenuOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await authLogout();
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
            <Link
              href="/"
              className="hover:opacity-80 transition-opacity"
            >
              <img 
                src="/logo-full.svg" 
                alt="Aurazone"
                className="h-8 sm:h-10 w-auto scale-150"
              />
            </Link>
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
            <div ref={profileMenuRef} className="relative hidden sm:flex">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 text-slate-900 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center gap-1"
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
              >
                <User strokeWidth={2} size={20} />
                <ChevronDown size={16} className={`${profileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1rem)] bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile Menu</p>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {isAuthenticated
                        ? (resolvedUser?.fullName || resolvedUser?.email || 'Signed in')
                        : 'Quick access links'}
                    </p>
                  </div>
                  <div className="py-1">
                    {BOTTOM_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                      const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
                      return (
                        <button
                          key={href}
                          type="button"
                          onClick={() => handleProfileNavigate(href)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active
                            ? 'bg-slate-100 text-slate-900 font-semibold'
                            : 'text-slate-700 hover:bg-gray-100'
                            }`}
                        >
                          <Icon size={16} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isAuthenticated && (
                    <div className="pt-1 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
