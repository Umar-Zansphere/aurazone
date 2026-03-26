'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Cart, Star, ShoppingCart, ChevronLeft, ChevronRight, Truck, RotateCcw, Shield, Check, AlertCircle, Minus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { productApi } from '@/lib/api';
import useCartStore from '@/store/cartStore';
import useWishlistStore from '@/store/wishlistStore';
// import RelatedProducts from '@/app/components/RelatedProducts';

const MAX_VARIANT_QUANTITY = 5;
const LOW_STOCK_THRESHOLD = 5;
const CONTACT_STORE_MESSAGE = 'Please contact store for bulk orders';

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
  const [variantQuantities, setVariantQuantities] = useState({});
  const [region, setRegion] = useState('EU');
  const [cartMessage, setCartMessage] = useState(null);
  const [wishlistMessage, setWishlistMessage] = useState(null);

  // Store hooks
  const addToCart = useCartStore((state) => state.addToCart);
  const isVariantPending = useCartStore((state) => state.isVariantPending);
  const cartItems = useCartStore((state) => state.items);
  const cartCount = useCartStore((state) => state.getCartCount());
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const isWishlistPending = useWishlistStore((state) => state.isWishlistPending);

  // Calculate current variant first (needed for derived state)
  const currentVariants = product?.variants?.filter(v => v.color === selectedColor) || [];
  const currentVariant = currentVariants.find(v => v.size === selectedSize) || currentVariants[0];
  const availableQuantity = currentVariant?.inventory
    ? Math.max(0, Number(currentVariant.inventory.quantity) - Number(currentVariant.inventory.reserved || 0))
    : 0;
  const maxSelectableQuantity = Math.max(0, Math.min(MAX_VARIANT_QUANTITY, availableQuantity));
  const isVariantUnavailable = currentVariant?.isAvailable === false;
  const isVariantOutOfStock = !currentVariant || isVariantUnavailable || availableQuantity <= 0;
  const isLimitedStock = !isVariantOutOfStock && availableQuantity < LOW_STOCK_THRESHOLD;
  const currentVariantId = currentVariant?.id || null;
  const quantity = currentVariantId ? (variantQuantities[currentVariantId] || 1) : 1;

  // Derived state
  const isLiked = wishlistItems.some(item => item.productId === productId);
  const cartItem = currentVariant ? cartItems.find(item => item.variantId === currentVariant.id) : null;
  const isInCart = !!cartItem;
  const isCartPending = currentVariantId ? isVariantPending(currentVariantId) : false;
  const isHeartPending = isWishlistPending(productId, currentVariant?.id || null);

  useEffect(() => {
    if (!currentVariantId) {
      return;
    }

    const nextMax = Math.max(1, maxSelectableQuantity);
    setVariantQuantities((prev) => {
      const currentQuantity = prev[currentVariantId] || 1;
      const nextQuantity = Math.max(1, Math.min(currentQuantity, nextMax));

      if (currentQuantity === nextQuantity && prev[currentVariantId] !== undefined) {
        return prev;
      }

      return {
        ...prev,
        [currentVariantId]: nextQuantity,
      };
    });
  }, [currentVariantId, maxSelectableQuantity]);

  // Fetch product details
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await productApi.getProductDetail(productId);
        const productData = data.data || data;
        setProduct(productData);
        setVariantQuantities({});

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

    if (isVariantOutOfStock) {
      setCartMessage({ type: 'error', text: 'This variant is out of stock' });
      return;
    }

    if (quantity > maxSelectableQuantity) {
      const cappedMessage = maxSelectableQuantity === MAX_VARIANT_QUANTITY
        ? `Maximum quantity per variant is ${MAX_VARIANT_QUANTITY}. ${CONTACT_STORE_MESSAGE}`
        : `Only ${maxSelectableQuantity} item(s) are currently available`;
      setCartMessage({ type: 'error', text: cappedMessage });
      return;
    }

    setCartMessage(null);
    try {
      await addToCart(currentVariant.id, quantity, {
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          gender: product.gender,
        },
        variant: currentVariant,
      });
      setCartMessage({ type: 'success', text: 'Added to cart!' });
      setTimeout(() => setCartMessage(null), 3000);
    } catch (err) {
      console.error('Error adding to cart:', err);
      setCartMessage({ type: 'error', text: err.message || 'Failed to add to cart' });
    }
  };

  const handleBuyNow = () => {
    if (!selectedSize) {
      setCartMessage({ type: 'error', text: 'Please select a size' });
      return;
    }

    if (!currentVariant) {
      setCartMessage({ type: 'error', text: 'Selected variant is unavailable' });
      return;
    }

    if (isVariantOutOfStock) {
      setCartMessage({ type: 'error', text: 'This variant is out of stock' });
      return;
    }

    if (quantity > maxSelectableQuantity) {
      const cappedMessage = maxSelectableQuantity === MAX_VARIANT_QUANTITY
        ? `Maximum quantity per variant is ${MAX_VARIANT_QUANTITY}. ${CONTACT_STORE_MESSAGE}`
        : `Only ${maxSelectableQuantity} item(s) are currently available`;
      setCartMessage({ type: 'error', text: cappedMessage });
      return;
    }

    // Direct to checkout with URL params for Buy Now
    router.push(`/checkout?buyNow=true&variantId=${currentVariant.id}&productId=${productId}&qty=${quantity}`);
  };



  const handleToggleWishlist = async () => {
    setWishlistMessage(null);
    const currentlyLiked = isLiked;

    try {
      await toggleWishlist(productId, currentVariant?.id || null, {
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          gender: product.gender,
        },
        variant: currentVariant || null,
      });
      setWishlistMessage({
        type: 'success',
        text: currentlyLiked ? 'Removed from wishlist' : 'Added to wishlist!',
      });
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
              disabled={isHeartPending}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors relative disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Heart
                size={24}
                className={`transition-colors ${isLiked ? 'fill-[#FF6B6B] text-[#FF6B6B]' : 'text-gray-800'}`}
              />
            </button>

            <Link
              href="/cart"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
              aria-label="Shopping cart"
            >
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
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 toast-message ${cartMessage.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
              }`}
          >
            <AlertCircle size={20} className={cartMessage.type === 'success' ? 'text-green-600' : 'text-red-600'} />
            <p className={cartMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {cartMessage.text}
            </p>
          </div>
        )}

        {wishlistMessage && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 toast-message ${wishlistMessage.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
              }`}
          >
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
            {/* Main Image Slider */}
            <div className="relative w-full aspect-square bg-linear-to-br from-gray-50 to-gray-100 rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center group shadow-sm border border-gray-100">
              {currentImages.length > 0 ? (
                <div 
                  className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  onScroll={(e) => {
                    const scrollLeft = e.currentTarget.scrollLeft;
                    const width = e.currentTarget.offsetWidth;
                    const index = Math.round(scrollLeft / width);
                    if (index !== selectedImageIndex) {
                      setSelectedImageIndex(index);
                    }
                  }}
                  ref={(el) => {
                    if (el && el.children[selectedImageIndex]) {
                      const child = el.children[selectedImageIndex];
                      if (Math.abs(el.scrollLeft - child.offsetLeft) > 10) {
                        el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
                      }
                    }
                  }}
                >
                  {currentImages.map((img, idx) => (
                    <div key={idx} className="w-full h-full shrink-0 snap-center relative flex items-center justify-center bg-white cursor-grab active:cursor-grabbing">
                      <img
                        src={img.url}
                        alt={`${product.name} - ${selectedColor} - ${idx + 1}`}
                        className="w-full h-full object-contain sm:object-cover transition-transform duration-700 ease-out hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                  <span className="text-sm font-medium">No image available</span>
                </div>
              )}

              {/* Navigation Arrows */}
              {currentImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.preventDefault(); prevImage(); }}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 sm:group-hover:opacity-100 transition-all duration-300 shadow-lg hover:bg-white hover:scale-110 active:scale-95 z-10 ${selectedImageIndex === 0 ? 'invisible opacity-0' : 'visible'}`}
                  >
                    <ChevronLeft size={24} className="text-gray-800" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); nextImage(); }}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 sm:group-hover:opacity-100 transition-all duration-300 shadow-lg hover:bg-white hover:scale-110 active:scale-95 z-10 ${selectedImageIndex === currentImages.length - 1 ? 'invisible opacity-0' : 'visible'}`}
                  >
                    <ChevronRight size={24} className="text-gray-800" />
                  </button>

                  {/* Bullet Indicators for Mobile */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/20 backdrop-blur-sm px-3 py-2 rounded-full sm:hidden">
                    {currentImages.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${selectedImageIndex === idx ? 'bg-white w-4' : 'bg-white/50 w-1.5'}`}
                        onClick={() => setSelectedImageIndex(idx)}
                      />
                    ))}
                  </div>
                  
                  {/* Enhanced Image Counter Pill */}
                  <div className="hidden sm:block absolute top-4 right-4 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-xs font-bold tracking-wide shadow-sm border border-white/10 z-10">
                    {selectedImageIndex + 1} / {currentImages.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Gallery with Slider */}
            {currentImages.length > 1 && (
              <div 
                className="flex gap-3 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1"
                ref={(el) => {
                  if (el && el.children[selectedImageIndex]) {
                     const child = el.children[selectedImageIndex];
                     const containerRect = el.getBoundingClientRect();
                     const childRect = child.getBoundingClientRect();
                     if (childRect.left < containerRect.left || childRect.right > containerRect.right) {
                       child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                     }
                  }
                }}
              >
                {currentImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 transition-all duration-300 snap-center relative focus:outline-none ${selectedImageIndex === idx
                      ? 'border-[#FF6B6B] shadow-md shadow-[#FF6B6B]/20 scale-[1.02] z-10'
                      : 'border-transparent bg-gray-100 hover:border-gray-300 focus:border-gray-300 opacity-70 hover:opacity-100'
                      }`}
                  >
                    <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    {selectedImageIndex === idx && (
                      <div className="absolute inset-0 bg-black/5 ring-1 ring-inset ring-[#FF6B6B]/20"></div>
                    )}
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
                      type="button"
                      onClick={() => handleColorChange(color)}
                      aria-pressed={selectedColor === color}
                      data-selected={selectedColor === color ? 'true' : 'false'}
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
            {currentVariants.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wide">
                    Select Size ({region})
                  </h3>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {currentVariants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedSize(variant.size)}
                      aria-pressed={selectedSize === variant.size}
                      data-selected={selectedSize === variant.size ? 'true' : 'false'}
                      className={`py-3 rounded-lg font-semibold text-sm transition-all duration-200 border-2 ${selectedSize === variant.size
                        ? 'border-[#FF6B6B] bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/30'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                    >
                      {variant.size}
                    </button>
                  ))}
                </div>
                {!selectedSize && (
                  <p className="text-red-500 text-xs mt-2 font-medium">Please select a size to continue</p>
                )}
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wide mb-3">
                Quantity
              </h3>
              <div className="flex items-center w-fit border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => {
                    if (!currentVariantId) {
                      return;
                    }
                    setVariantQuantities((prev) => ({
                      ...prev,
                      [currentVariantId]: Math.max(1, quantity - 1),
                    }));
                  }}
                  className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={quantity <= 1}
                >
                  <Minus size={18} />
                </button>
                <div className="w-14 h-12 flex items-center justify-center font-bold text-lg text-[#1E293B] border-x-2 border-gray-200">
                  {quantity}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isVariantOutOfStock || maxSelectableQuantity <= 0) {
                      setCartMessage({ type: 'error', text: 'This variant is out of stock' });
                      return;
                    }

                    if (quantity >= maxSelectableQuantity) {
                      const cappedMessage = maxSelectableQuantity === MAX_VARIANT_QUANTITY
                        ? `Maximum quantity per variant is ${MAX_VARIANT_QUANTITY}. ${CONTACT_STORE_MESSAGE}`
                        : `Only ${maxSelectableQuantity} item(s) are currently available`;
                      setCartMessage({ type: 'error', text: cappedMessage });
                      return;
                    }

                    if (!currentVariantId) {
                      return;
                    }
                    setVariantQuantities((prev) => ({
                      ...prev,
                      [currentVariantId]: quantity + 1,
                    }));
                  }}
                  className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isVariantOutOfStock || maxSelectableQuantity <= 0 || quantity >= maxSelectableQuantity}
                >
                  <Plus size={18} />
                </button>
              </div>

              {isVariantOutOfStock ? (
                <p className="mt-2 text-xs font-medium text-red-600">Out of stock</p>
              ) : isLimitedStock ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Limited stock: {availableQuantity} left
                </p>
              ) : null}

              {!isVariantOutOfStock && quantity >= maxSelectableQuantity && (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {maxSelectableQuantity === MAX_VARIANT_QUANTITY
                    ? `Max ${MAX_VARIANT_QUANTITY} per variant. ${CONTACT_STORE_MESSAGE}`
                    : `Only ${maxSelectableQuantity} item(s) currently available`}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
              {isInCart ? (
                <button
                  onClick={() => router.push('/cart')}
                  className="flex-1 bg-green-50 text-green-700 border-2 border-green-200 py-4 rounded-xl font-bold text-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={22} strokeWidth={2.5} />
                  Added to Cart
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={isCartPending || isVariantOutOfStock}
                  className="flex-1 bg-white text-[#FF6B6B] border-2 border-[#FF6B6B] py-4 rounded-xl font-bold text-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={22} strokeWidth={2.5} className={isCartPending ? 'animate-spin' : 'group-hover:animate-bounce'} />
                  {isCartPending ? 'Adding...' : 'Add to Cart'}
                </button>
              )}

              <button
                onClick={handleBuyNow}
                disabled={isVariantOutOfStock}
                className="flex-1 bg-linear-to-r from-[#FF6B6B] to-[#FF5252] text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-[#FF6B6B]/30 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-1 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-xl disabled:hover:translate-y-0"
              >
                Buy Now
              </button>
            </div>
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
