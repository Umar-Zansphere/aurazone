'use client';

import { useState, useEffect } from 'react';
import { Trash2, ShoppingBag, Heart, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/app/components/Header';
import useWishlistStore from '@/store/wishlistStore';
import useCartStore from '@/store/cartStore';
import { useToast } from '@/components/ToastContext';
import { WishlistLoadingSkeleton } from '@/components/LoadingSkeleton';

export default function WishlistPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [addingToCart, setAddingToCart] = useState({});

  // Use wishlist and cart stores
  const { items: wishlistItems, isLoading: loading, fetchWishlist, removeItem, moveToCart } = useWishlistStore();
  const { addToCart } = useCartStore();

  // Fetch wishlist data on mount
  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Remove item from wishlist
  const handleRemoveItem = async (itemId) => {
    try {
      await removeItem(itemId);
      // showToast('Item removed from wishlist', 'success');
    } catch (err) {
      console.error('Error removing item:', err);
      showToast('Failed to remove item', 'error');
    }
  };

  // Move item to cart
  const handleMoveToCart = async (item) => {
    if (!item.variantId) {
      showToast('Please select a variant before adding to cart', 'warning');
      return;
    }

    try {
      setAddingToCart(prev => ({ ...prev, [item.id]: true }));

      // Use moveToCart from wishlist store (removes from wishlist and adds to cart)
      await moveToCart(item.id);

      // showToast('Item moved to cart', 'success');
    } catch (err) {
      console.error('Error moving to cart:', err);
      showToast('Failed to move item to cart', 'error');
    } finally {
      setAddingToCart(prev => ({ ...prev, [item.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <WishlistLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />

      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6"
        >
          <ChevronLeft size={20} />
          <span className="font-medium">Back to Home</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">

        {wishlistItems.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <Heart size={64} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Your wishlist is empty</h2>
            <p className="text-slate-600 mb-6">Save your favorite products to view later</p>
            <Link href="/products">
              <button className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors">
                Explore Products
              </button>
            </Link>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-xl shadow-sm mb-6">
              <div className="p-6">
                <h1 className="text-2xl font-bold text-slate-900">
                  My Wishlist
                </h1>
                <p className="text-slate-600 mt-1">{wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'}</p>
              </div>

              {/* Wishlist Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {wishlistItems.map(item => (
                  <div key={item.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                    {/* Product Image */}
                    <Link href={`/product/${item.productId}`}>
                      <div className="w-full h-56 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-slate-100 transition relative">
                        {item.variant?.images?.[0]?.url ? (
                          <Image
                            src={item.variant.images[0].url}
                            alt={item.product?.name || 'Product'}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-contain p-4"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-slate-400 text-center">
                            <ShoppingBag size={32} className="mx-auto mb-2" />
                            <p className="text-sm">No image</p>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Product Details */}
                    <div className="p-4">
                      <Link href={`/product/${item.productId}`}>
                        <h3 className="text-lg font-semibold text-slate-900 hover:text-orange-600 cursor-pointer truncate">
                          {item.product?.name}
                        </h3>
                      </Link>

                      <p className="text-sm text-slate-600 mt-1">
                        {item.product?.brand}
                      </p>

                      {/* Variant Details */}
                      {item.variant && (
                        <div className="mt-2 text-sm text-slate-600 space-y-1">
                          <p>Color: <span className="font-medium text-slate-900">{item.variant.color}</span></p>
                          <p>Size: <span className="font-medium text-slate-900">{item.variant.size}</span></p>
                        </div>
                      )}

                      {/* Price */}
                      <div className="mt-4">
                        <p className="text-xl font-bold text-slate-900">
                          ₹{parseFloat(item.variant?.price || 0).toLocaleString('en-IN')}
                        </p>
                        {item.variant?.compareAtPrice && (
                          <p className="text-sm text-slate-500 line-through">
                            ₹{parseFloat(item.variant.compareAtPrice).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>

                      {/* Availability */}
                      <div className="mt-3">
                        <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${item.variant?.isAvailable
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                          }`}>
                          {item.variant?.isAvailable ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleMoveToCart(item)}
                          disabled={!item.variant?.isAvailable || addingToCart[item.id]}
                          className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {addingToCart[item.id] ? 'Adding...' : 'Move to Cart'}
                        </button>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Remove from wishlist"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Continue Shopping */}
            <div className="text-center">
              <Link href="/products">
                <button className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors">
                  Continue Shopping
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
