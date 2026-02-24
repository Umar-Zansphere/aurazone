'use client';

import { Heart, Check, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useCartStore from '@/store/cartStore';
import useWishlistStore from '@/store/wishlistStore';
import { useToast } from '@/components/ToastContext';

export default function ProductCard({ product }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Use stores
  const { addToCart, isInCart } = useCartStore();
  const { addToWishlist, removeItem, isInWishlist } = useWishlistStore();

  if (!product) return null;

  // Handle variant prices - get the minimum price from all variants
  const variants = product.variants || [];
  const firstVariant = variants[0];
  const price = firstVariant?.price || product.price || 0;
  const discount = product.discount || "10% OFF";
  const category = product.category || "SHOES";
  const imageUrl = firstVariant?.images?.[0]?.url || product.image;

  // Check if product is in wishlist directly from store state
  const wishlistAdded = isInWishlist(product.id, firstVariant?.id);

  // Check if product is in cart directly from store state
  const inCart = firstVariant ? isInCart(firstVariant.id) : false;

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant || isAddingToCart || inCart) return;

    setIsAddingToCart(true);

    try {
      await addToCart(firstVariant.id, 1);
      setCartAdded(true);
      // showToast('Added to cart', 'success');
      setTimeout(() => setCartAdded(false), 2000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      showToast(error.message || 'Failed to add to cart', 'error');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleToggleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant) return;

    try {
      if (wishlistAdded) {
        const wishlistItems = useWishlistStore.getState().items;
        const item = wishlistItems.find(
          w => w.productId === product.id && w.variantId === firstVariant.id
        );
        if (item) {
          await removeItem(item.id);
          // showToast('Removed from wishlist', 'info');
        }
      } else {
        await addToWishlist(product.id, firstVariant.id);
        // showToast('Added to wishlist', 'success');
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      showToast('Failed to update wishlist', 'error');
    }
  };

  return (
    <Link href={`/product/${product.id}`} className="block h-full">
      <div className="group flex flex-col h-full w-full bg-white rounded-xl border border-gray-100 p-3 sm:p-4 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300 cursor-pointer">
        <div className="relative w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center mb-3 bg-gray-50">
          <button
            onClick={handleToggleLike}
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

          <div className="mt-auto flex items-center justify-between gap-3">
            <p className="text-slate-900 font-black text-lg sm:text-xl">
              ₹{parseFloat(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>

            <button
              onClick={handleAddToCart}
              disabled={isAddingToCart || inCart}
              className={`-shrink-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${inCart
                ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                : cartAdded
                  ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20 scale-110'
                  : 'bg-slate-900 hover:bg-slate-800 active:scale-95 shadow-slate-900/20 text-white'
                }`}
              aria-label={inCart ? "In cart" : cartAdded ? "Added to cart" : "Add to cart"}
            >
              {inCart ? (
                <Check size={20} className="text-white" />
              ) : cartAdded ? (
                <Check size={20} className="animate-in zoom-in-50 duration-200" />
              ) : isAddingToCart ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShoppingCart size={20} />
              )}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}