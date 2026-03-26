'use client';

import { Heart, Check, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import useCartStore from '@/store/cartStore';
import useWishlistStore from '@/store/wishlistStore';
import { useToast } from '@/components/ToastContext';

const LOW_STOCK_THRESHOLD = 5;

export default function ProductCard({ product }) {
  const { showToast } = useToast();
  const [imageLoaded, setImageLoaded] = useState(false);

  const cartItems = useCartStore((state) => state.items);
  const cartPendingByVariant = useCartStore((state) => state.pendingByVariant);
  const toggleVariantInCart = useCartStore((state) => state.toggleVariantInCart);
  const wishlistItems = useWishlistStore((state) => state.items);
  const wishlistPendingByKey = useWishlistStore((state) => state.pendingByKey);
  const toggleWishlistByProduct = useWishlistStore((state) => state.toggleWishlistByProduct);

  if (!product) return null;

  // Handle variant prices - get the minimum price from all variants
  const variants = product.variants || [];
  const firstVariant = variants[0];
  const price = firstVariant?.price || product.price || 0;
  const discount = product.discount || "10% OFF";
  const category = product.category || "SHOES";
  const imageUrl = firstVariant?.images?.[0]?.url || product.image;
  const availableQuantity = firstVariant?.inventory
    ? Math.max(0, Number(firstVariant.inventory.quantity) - Number(firstVariant.inventory.reserved || 0))
    : 0;
  const isVariantUnavailable = firstVariant?.isAvailable === false;
  const isOutOfStock = !firstVariant || isVariantUnavailable || availableQuantity <= 0;
  const isLimitedStock = !isOutOfStock && availableQuantity < LOW_STOCK_THRESHOLD;

  const inCart = firstVariant
    ? cartItems.some((item) => item.variantId === firstVariant.id)
    : false;
  const wishlistAdded = wishlistItems.some((item) => item.productId === product.id);

  const isCartPending = firstVariant
    ? Boolean(cartPendingByVariant?.[firstVariant.id])
    : false;
  const wishlistKeyPrefix = `${product.id}::`;
  const isHeartPending = Object.keys(wishlistPendingByKey || {}).some((key) =>
    key.startsWith(wishlistKeyPrefix)
  );

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant || isOutOfStock) return;

    try {
      await toggleVariantInCart(firstVariant.id, 1, {
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          gender: product.gender,
        },
        variant: firstVariant,
      });
    } catch (error) {
      console.error('Error updating cart from product card:', error);
      showToast(error.message || 'Failed to update cart', 'error');
    }
  };

  const handleToggleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant) return;

    try {
      await toggleWishlistByProduct(product.id, firstVariant.id, {
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          gender: product.gender,
        },
        variant: firstVariant,
      });
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      showToast('Failed to update wishlist', 'error');
    }
  };

  return (
    <Link href={`/product/${product.id}`} className="block h-full">
      <div className="group relative flex flex-col h-full w-full rounded-xl border p-3 sm:p-4 shadow-sm transition-all duration-300 cursor-pointer bg-white border-gray-100 hover:shadow-xl hover:border-gray-200">
        <div className="relative w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center mb-3 bg-gray-50">
          <button
            onClick={handleToggleLike}
            disabled={isHeartPending}
            className="absolute top-3 right-3 z-10 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 hover:bg-white hover:scale-110 transition-all shadow-md active:scale-95 touch-manipulation"
            aria-label={wishlistAdded ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={20}
              className={`transition-all duration-200 ${wishlistAdded ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-600'}`}
            />
          </button>

          {imageUrl ? (
            <div className="relative w-full h-full">
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-xl" />
              )}
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className={`object-contain drop-shadow-2xl transition-all duration-500 ease-out group-hover:scale-110 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-xl">
              <span className="text-gray-400 text-sm">No image</span>
            </div>
          )}

        </div>

        <div className="flex flex-col flex-1 px-1">
          <p className="text-gray-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1.5">
            {category}
          </p>

          <h3 className="text-slate-900 font-bold text-sm sm:text-base leading-tight mb-2 line-clamp-2 min-h-10 group-hover:text-orange-600 transition-colors" title={product.name}>
            {product.name}
          </h3>

          {product.brand && (
            <p className="text-gray-600 text-xs sm:text-sm font-semibold mb-2 truncate">
              {product.brand}
            </p>
          )}

          {isLimitedStock && (
            <p className="mb-2 inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              Limited stock
            </p>
          )}

          {isOutOfStock ? (
            <div className="mt-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-red-700">
                Out of stock
              </p>
            </div>
          ) : (
            <div className="mt-auto flex items-center justify-between gap-3">
              <p className="text-slate-900 font-black text-lg sm:text-xl">
                ₹{parseFloat(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>

              <button
                onClick={handleAddToCart}
                disabled={isCartPending}
                className={`-shrink-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${inCart
                  ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 active:scale-95 shadow-slate-900/20 text-white'
                  }`}
                aria-label={inCart ? "Remove from cart" : "Add to cart"}
              >
                {inCart ? (
                  <Check size={20} className="text-white" />
                ) : isCartPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ShoppingCart size={20} />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
