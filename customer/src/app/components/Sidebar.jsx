'use client';

import { X, LogOut, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const Sidebar = ({ isOpen, onClose, onAuthRequest }) => {
  const [filterOptions, setFilterOptions] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoutModal, setLogoutModal] = useState({ isOpen: false, type: null, message: '' });
  const router = useRouter();
  const { user, logout: authLogout } = useAuth();

  useEffect(() => {
    if (isOpen && !filterOptions) {
      loadFilterOptions();
    }
  }, [isOpen, filterOptions]);

  const loadFilterOptions = async () => {
    try {
      setLoading(true);
      const data = await productApi.getFilterOptions();
      setFilterOptions(data.data || data);
    } catch (error) {
      console.error('Failed to load filter options:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path) => {
    router.push(path);
    onClose();
  };

  const handleGenderFilter = (gender) => {
    setSelectedGender(gender);
    router.push(`/products?gender=${encodeURIComponent(gender)}`);
    onClose();
  };

  const handleCategoryFilter = (category) => {
    router.push(`/products?category=${encodeURIComponent(category)}`);
    onClose();
  };

  const handleLogout = async () => {
    try {
      // Use auth context logout which handles everything
      await authLogout();

      // Show success modal
      setLogoutModal({
        isOpen: true,
        type: 'success',
        message: 'You have been logged out successfully!'
      });

      onClose();
    } catch (error) {
      console.error('Logout failed:', error);

      // Show error modal
      setLogoutModal({
        isOpen: true,
        type: 'error',
        message: 'Logout failed. Please try again.'
      });
    }
  };

  const handleModalClose = () => {
    setLogoutModal({ isOpen: false, type: null, message: '' });
    router.push('/');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Content */}
      <div className={`fixed top-0 left-0 h-full w-[85%] max-w-sm z-100 bg-slate-900 text-white shadow-2xl transform transition-transform duration-300 ease-out overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col min-h-full">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black tracking-tight text-white">
              SoleMate<span className="text-orange-500">.</span>
            </h2>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-95 touch-manipulation min-w-11 min-h-11 flex items-center justify-center"
              aria-label="Close menu"
            >
              <X size={24} className="text-gray-300" />
            </button>
          </div>


          {/* Quick Navigation */}
          <nav className="mb-6 space-y-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Shop</p>
            <button
              onClick={() => handleNavigate('/products?isFeatured=true')}
              className="w-full text-left py-3.5 px-4 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all active:scale-98 touch-manipulation"
            >
              🌟 New Arrivals
            </button>
            <button
              onClick={() => handleNavigate('/products?isFeatured=true')}
              className="w-full text-left py-3.5 px-4 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all active:scale-98 touch-manipulation"
            >
              ⭐ Featured
            </button>
            <button
              onClick={() => handleNavigate('/products')}
              className="w-full text-left py-3.5 px-4 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all active:scale-98 touch-manipulation"
            >
              👟 All Products
            </button>
          </nav>

          {/* Gender Filter */}
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">By Gender</p>
            <div className="space-y-2">
              {['MEN', 'WOMEN', 'UNISEX', 'KIDS'].map((gender) => (
                <button
                  key={gender}
                  onClick={() => handleGenderFilter(gender)}
                  className={`w-full text-left py-3 px-4 rounded-xl text-sm transition-all active:scale-98 touch-manipulation ${selectedGender === gender
                    ? 'bg-white/15 text-white font-bold shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                  {gender.charAt(0) + gender.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">By Category</p>
            <div className="space-y-2">
              {['RUNNING', 'CASUAL', 'FORMAL', 'SNEAKERS'].map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryFilter(category)}
                  className="w-full text-left py-3 px-4 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all active:scale-98 touch-manipulation"
                >
                  {category.charAt(0) + category.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Brand Filter */}
          {filterOptions?.brands && filterOptions.brands.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Popular Brands</p>
              <div className="space-y-2">
                {filterOptions.brands.slice(0, 5).map((brand) => (
                  <button
                    key={brand}
                    onClick={() => {
                      router.push(`/products?brand=${encodeURIComponent(brand)}`);
                      onClose();
                    }}
                    className="w-full text-left py-3 px-4 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all active:scale-98 touch-manipulation"
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default Sidebar;
