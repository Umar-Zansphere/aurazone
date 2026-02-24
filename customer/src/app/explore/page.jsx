'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import { productApi } from '@/lib/api';
import { ArrowRight, Zap, TrendingUp, Award, Sparkles } from 'lucide-react';

export default function ExplorePage() {
  const router = useRouter();
  const [filterOptions, setFilterOptions] = useState(null);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [filtersData, productsData] = await Promise.all([
          productApi.getFilterOptions(),
          productApi.getPopularProducts({ take: 8 })
        ]);
        setFilterOptions(filtersData.data || filtersData);
        const prods = Array.isArray(productsData) ? productsData : (productsData.data || []);
        setFeaturedProducts(prods);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const categories = [
    { name: 'Running', icon: '🏃', color: 'from-blue-500 to-blue-600' },
    { name: 'Casual', icon: '👟', color: 'from-purple-500 to-purple-600' },
    { name: 'Formal', icon: '🎩', color: 'from-slate-500 to-slate-600' },
    { name: 'Sneakers', icon: '✨', color: 'from-pink-500 to-pink-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero Section */}
        <div className="mb-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl -mr-48 -mt-48" />
            </div>
            <div className="relative z-10">
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
                Discover Your Perfect Shoe
              </h1>
              <p className="text-lg text-slate-300 mb-8 max-w-2xl">
                Explore thousands of premium footwear options. Find your style across multiple brands, categories, and collections.
              </p>
              <button
                onClick={() => router.push('/products')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl transition-colors"
              >
                Browse All Products
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
            <div className="inline-block p-3 bg-blue-100 rounded-2xl mb-4">
              <TrendingUp size={32} className="text-blue-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">10K+</h3>
            <p className="text-slate-600">Products available</p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
            <div className="inline-block p-3 bg-orange-100 rounded-2xl mb-4">
              <Award size={32} className="text-orange-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">50+</h3>
            <p className="text-slate-600">Top brands</p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
            <div className="inline-block p-3 bg-green-100 rounded-2xl mb-4">
              <Zap size={32} className="text-green-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">100%</h3>
            <p className="text-slate-600">Authentic guarantee</p>
          </div>
        </div>

        {/* Categories Section */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-slate-900">Shop by Category</h2>
            <button
              onClick={() => router.push('/products')}
              className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-2 transition-colors"
            >
              View All
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => router.push(`/products?category=${category.name.toUpperCase()}`)}
                className={`group relative overflow-hidden rounded-3xl p-8 text-white font-bold text-lg transition-transform hover:scale-105 bg-gradient-to-br ${category.color} shadow-lg`}
              >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <span className="text-4xl">{category.icon}</span>
                  <span>{category.name}</span>
                  <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Brands Spotlight */}
        {filterOptions?.brands && filterOptions.brands.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black text-slate-900">Popular Brands</h2>
              <button
                onClick={() => router.push('/products')}
                className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-2 transition-colors"
              >
                View All
                <ArrowRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filterOptions.brands.slice(0, 8).map((brand) => (
                <button
                  key={brand}
                  onClick={() => router.push(`/products?brand=${encodeURIComponent(brand)}`)}
                  className="bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-orange-500 hover:shadow-lg transition-all text-center group"
                >
                  <h3 className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                    {brand}
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">Shop Collection</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500 to-orange-600 p-8 sm:p-12 text-center">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -mr-48 -mt-48" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-center mb-4">
              <Sparkles size={40} className="text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Ready to Find Your Perfect Shoe?
            </h2>
            <p className="text-lg text-orange-100 mb-8 max-w-2xl mx-auto">
              Explore our complete collection with advanced filters, search, and sorting options to find exactly what you're looking for.
            </p>
            <button
              onClick={() => router.push('/products')}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white hover:bg-slate-100 text-orange-600 font-bold rounded-2xl transition-colors"
            >
              Start Shopping
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
