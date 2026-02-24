'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Cart, Star, ShoppingCart, ChevronLeft, ChevronRight, Truck, RotateCcw, Shield, Check, AlertCircle, Minus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { productApi, cartApi, wishlistApi, storageApi } from '@/lib/api';
import useCartStore from '@/store/cartStore';
import useWishlistStore from '@/store/wishlistStore';
// import RelatedProducts from '@/app/components/RelatedProducts';

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [region, setRegion] = useState('EU');
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState(null);
  const [wishlistMessage, setWishlistMessage] = useState(null);

  // Store hooks
  const addToCart = useCartStore((state) => state.addToCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeItem);
  const cartItems = useCartStore((state) => state.items);
  const cartCount = useCartStore((state) => state.getCartCount());
  const wishlistItems = useWishlistStore((state) => state.items);
  const addToWishlist = useWishlistStore((state) => state.addToWishlist);
  const removeFromWishlist = useWishlistStore((state) => state.removeItem);

  // Calculate current variant first (needed for derived state)
  const currentVariants = product?.variants?.filter(v => v.color === selectedColor) || [];
  const currentVariant = currentVariants.find(v => v.size === selectedSize) || currentVariants[0];

  // Derived state
  const isLiked = wishlistItems.some(item => item.productId === productId);
  const cartItem = currentVariant ? cartItems.find(item => item.variantId === currentVariant.id) : null;
  const isInCart = !!cartItem;
  const cartItemQuantity = cartItem?.quantity || 0;

  // Fetch product details
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await productApi.getProductDetail(productId);
        const productData = data.data || data;
        setProduct(productData);

        // Set initial color and size
        if (productData.variants && productData.variants.length > 0) {
          setSelectedColor(productData.variants[0].color);
          setSelectedSize(productData.variants[0].size);
        }
      } catch (err) {
        console.error('Failed to load product:', err);
        setError('Failed to load product. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      loadProduct();
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#FF6B6B]"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-[#1E293B] flex-1 text-center px-4">
              Product Not Found
            </h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 mb-6">{error || 'This product could not be found.'}</p>
          <Link href="/products" className="inline-block px-6 py-3 bg-[#FF6B6B] text-white rounded-lg hover:bg-[#FF5252]">
            Continue Shopping
          </Link>
        </main>
      </div>
    );
  }

  const currentImages = currentVariant?.images || [];
  const currentImage = currentImages[selectedImageIndex]?.url || currentImages[0]?.url;

  const uniqueColors = [...new Set(product?.variants?.map(v => v.color) || [])];
  const uniqueSizes = [...new Set(product?.variants?.map(v => v.size) || [])];

  const handleColorChange = (color) => {
    setSelectedColor(color);
    setSelectedImageIndex(0);
    const variantsWithColor = product?.variants?.filter(v => v.color === color) || [];
    if (variantsWithColor.length > 0) {
      setSelectedSize(variantsWithColor[0].size);
    }
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % currentImages.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) =>
      prev === 0 ? currentImages.length - 1 : prev - 1
    );
  };

  const ratingValue = 4.5; // Mock rating for now
  const reviewCount = '1,234'; // Mock review count

  const handleAddToCart = async () => {
    if (!selectedSize) {
      setCartMessage({ type: 'error', text: 'Please select a size' });
      return;
    }

    if (!currentVariant) {
      setCartMessage({ type: 'error', text: 'Selected variant is unavailable' });
      return;
    }

    setIsAddingToCart(true);
    setCartMessage(null);
    try {
      console.log('Adding to cart via Store:', { variantId: currentVariant.id, quantity: 1 });
      await addToCart(currentVariant.id, 1);
      setCartMessage({ type: 'success', text: 'Added to cart!' });
      setTimeout(() => setCartMessage(null), 3000);
    } catch (err) {
      console.error('Error adding to cart:', err);
      setCartMessage({ type: 'error', text: err.message || 'Failed to add to cart' });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleUpdateQuantity = async (newQuantity) => {
    if (!cartItem) return;

    try {
      if (newQuantity < 1) {
        await removeFromCart(cartItem.id);
        setCartMessage({ type: 'success', text: 'Removed from cart' });
      } else {
        await updateQuantity(cartItem.id, newQuantity);
      }
    } catch (err) {
      console.error('Error updating quantity:', err);
      setCartMessage({ type: 'error', text: 'Failed to update quantity' });
    }
  };

  const handleToggleWishlist = async () => {
    setWishlistMessage(null);

    // If already liked, remove it. Logic implies finding the wishlistItemId effectively.
    // However, existing store implementation of removeItem needs the ID of the wishlist item (relationship record), not product ID.
    // But since `wishlistItems` contains the full objects, we can find it.

    try {
      if (isLiked) {
        const wishlistItem = wishlistItems.find(item => item.productId === productId);
        if (wishlistItem) {
          await removeFromWishlist(wishlistItem.id);
          setWishlistMessage({ type: 'success', text: 'Removed from wishlist' });
        }
      } else {
        // For adding, prefer adding the specific variant if selected, else just product
        const variantIdToAdd = currentVariant?.id || null;
        console.log('Adding to wishlist via Store:', { productId, variantId: variantIdToAdd });
        await addToWishlist(productId, variantIdToAdd);
        setWishlistMessage({ type: 'success', text: 'Added to wishlist!' });
      }
      setTimeout(() => setWishlistMessage(null), 3000);
    } catch (err) {
      console.error('Error toggling wishlist:', err);
      setWishlistMessage({ type: 'error', text: err.message || 'Failed to update wishlist' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition-colors p-2 -ml-2 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <h1 className="text-sm sm:text-base font-semibold text-[#1E293B] text-center flex-1 px-4 truncate">
            {product.name}
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleWishlist}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
            >
              <Heart
                size={24}
                className={`transition-colors ${isLiked ? 'fill-[#FF6B6B] text-[#FF6B6B]' : 'text-gray-800'}`}
              />
            </button>

            <Link href="/cart" className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
              <ShoppingCart size={24} className="text-gray-800" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-[#FF6B6B] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 pb-32 sm:pb-8">
        {/* Feedback Messages */}
        {cartMessage && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${cartMessage.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
            }`}>
            <AlertCircle size={20} className={cartMessage.type === 'success' ? 'text-green-600' : 'text-red-600'} />
            <p className={cartMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {cartMessage.text}
            </p>
          </div>
        )}

        {wishlistMessage && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${wishlistMessage.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
            }`}>
            <AlertCircle size={20} className={wishlistMessage.type === 'success' ? 'text-green-600' : 'text-red-600'} />
            <p className={wishlistMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {wishlistMessage.text}
            </p>
          </div>
        )}

        {/* Layout: Image on left, Details on right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">

          {/* LEFT: Image Gallery */}
          <div className="flex flex-col gap-4">
            {/* Main Image */}
            <div className="relative w-full aspect-square bg-linear-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden flex items-center justify-center group">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={`${product.name} - ${selectedColor}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="text-gray-400">No image available</div>
              )}

              {/* Navigation Arrows */}
              {currentImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                  >
                    <ChevronLeft size={22} className="text-gray-800" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                  >
                    <ChevronRight size={22} className="text-gray-800" />
                  </button>

                  {/* Image Counter */}
                  <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-semibold">
                    {selectedImageIndex + 1}/{currentImages.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {currentImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {currentImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedImageIndex === idx
                      ? 'border-[#FF6B6B] shadow-md scale-105'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product Details Panel */}
          <div className="flex flex-col">
            {/* Header Info */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 font-medium mb-1">{product.category}</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#1E293B]">
                    {product.name}
                  </h2>
                </div>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={18}
                        className={i < Math.floor(ratingValue) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-gray-900">{ratingValue}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {reviewCount} reviews
                </span>
              </div>

              {/* Price */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Price</p>
                <p className="text-3xl font-black text-[#FF6B6B]">
                  ₹{currentVariant?.price ? parseFloat(currentVariant.price).toLocaleString() : 'N/A'}
                </p>
                {currentVariant?.compareAtPrice && (
                  <p className="text-sm text-gray-500 line-through mt-1">
                    ₹{parseFloat(currentVariant.compareAtPrice).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                  {product.description}
                </p>
              </div>
            )}

            {/* Color Selection */}
            {uniqueColors.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wide mb-4">
                  Color Variant
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {uniqueColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={`relative group transition-all`}
                    >
                      <div className={`w-16 h-16 rounded-xl border-2 overflow-hidden transition-all flex items-center justify-center ${selectedColor === color
                        ? 'border-[#FF6B6B] shadow-lg scale-105'
                        : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                        }`}>
                        <img src={product?.variants?.find(v => v.color === color)?.images?.[0]?.url || ''} alt={color} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {color}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {uniqueSizes.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wide">
                    Select Size ({region})
                  </h3>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {uniqueSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`py-3 rounded-lg font-semibold text-sm transition-all duration-200 border-2 ${selectedSize === size
                        ? 'border-[#FF6B6B] bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/30'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {!selectedSize && (
                  <p className="text-red-500 text-xs mt-2 font-medium">Please select a size to continue</p>
                )}
              </div>
            )}

            {/* Action Buttons */}

            {/* Add to Cart Button or Quantity Selector */}
            {isInCart ? (
              <div className="w-fit bg-linear-to-r from-[#FF6B6B] to-[#FF5252] text-white rounded-xl py-2 px-4 shadow-xl shadow-[#FF6B6B]/30">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleUpdateQuantity(cartItemQuantity - 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {cartItemQuantity === 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                  </button>
                  <span className="text-xl font-bold w-8 text-center">{cartItemQuantity}</span>
                  <button
                    onClick={() => handleUpdateQuantity(cartItemQuantity + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="w-full bg-linear-to-r from-[#FF6B6B] to-[#FF5252] text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-[#FF6B6B]/30 hover:shadow-2xl hover:shadow-[#FF6B6B]/40 hover:-translate-y-0.5 active:translate-y-1 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:translate-y-0"
              >
                <ShoppingCart size={22} strokeWidth={2.5} className={isAddingToCart ? 'animate-spin' : 'group-hover:animate-bounce'} />
                {isAddingToCart ? 'Adding to Cart...' : 'Add to Cart'}
              </button>
            )}
          </div>
        </div>

        {/* Related Products */}
        {/* {product.variants && product.variants.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-[#1E293B] mb-8">You Might Also Like</h2>
            <RelatedProducts products={[]} />
          </div>
        )} */}
      </main>
    </div>
  );
}