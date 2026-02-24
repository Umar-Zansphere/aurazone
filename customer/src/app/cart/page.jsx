'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, Minus, ShoppingBag, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/app/components/Header';
import useCartStore from '@/store/cartStore';
import { useToast } from '@/components/ToastContext';
import { CartLoadingSkeleton } from '@/components/LoadingSkeleton';

export default function CartPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Use cart store
  const { items: cartItems, isLoading: loading, fetchCart, updateQuantity, removeItem, getCartTotal } = useCartStore();

  // Fetch cart data on mount
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Update quantity
  const handleUpdateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;

    try {
      await updateQuantity(itemId, newQuantity);
      showToast('Quantity updated', 'success');
    } catch (err) {
      console.error('Error updating quantity:', err);
      showToast('Failed to update quantity', 'error');
    }
  };

  // Remove item from cart
  const handleRemoveItem = async (itemId) => {
    try {
      await removeItem(itemId);
      showToast('Item removed from cart', 'success');
    } catch (err) {
      console.error('Error removing item:', err);
      showToast('Failed to remove item', 'error');
    }
  };

  // Calculate totals using store helper
  const subtotal = getCartTotal();
  const shippingFee = 40;
  const total = subtotal + shippingFee;

  // Handle checkout
  const handleCheckout = () => {
    if (cartItems.length === 0) {
      showToast('Your cart is empty', 'warning');
      return;
    }
    router.push('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <CartLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />

      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <button
          onClick={() => router.push('/products')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6"
        >
          <ChevronLeft size={20} />
          <span className="font-medium">Continue Shopping</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">

        {cartItems.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <ShoppingBag size={64} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
            <p className="text-slate-600 mb-6">Add some products to get started</p>
            <Link href="/products">
              <button className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors">
                Browse Products
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm">
                <div className="p-6">
                  <h1 className="text-2xl font-bold text-slate-900">
                    Shopping Cart
                  </h1>
                  <p className="text-slate-600 mt-1">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</p>
                </div>

                <div className="space-y-4 px-6 pb-6">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                      {/* Product Image */}
                      <Link href={`/product/${item.productId}`}>
                        <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0 cursor-pointer hover:shadow-md transition relative">
                          {item.variant?.images?.[0]?.url ? (
                            <Image
                              src={item.variant.images[0].url}
                              alt={item.product?.name || 'Product'}
                              fill
                              sizes="96px"
                              className="object-contain p-2"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ShoppingBag size={32} />
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/product/${item.productId}`}>
                          <h3 className="text-lg font-semibold text-slate-900 hover:text-orange-600 cursor-pointer truncate">
                            {item.product?.name}
                          </h3>
                        </Link>

                        <p className="text-sm text-slate-600 mt-1">
                          {item.product?.brand}
                        </p>

                        <div className="flex gap-4 text-sm mt-2">
                          <span className="text-slate-600">
                            Color: <span className="font-medium text-slate-900">{item.variant?.color}</span>
                          </span>
                          <span className="text-slate-600">
                            Size: <span className="font-medium text-slate-900">{item.variant?.size}</span>
                          </span>
                        </div>

                        {/* Price & Quantity */}
                        <div className="flex items-center justify-between mt-4">
                          <div>
                            <p className="text-xl font-bold text-slate-900">
                              ₹{parseFloat(item.unitPrice || item.price || 0).toLocaleString('en-IN')}
                            </p>
                            {item.variant?.compareAtPrice && (
                              <p className="text-sm text-slate-500 line-through">
                                ₹{parseFloat(item.variant.compareAtPrice).toLocaleString('en-IN')}
                              </p>
                            )}
                          </div>

                          {/* Quantity Selector */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                              <button
                                onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                className="p-1 hover:bg-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={item.quantity <= 1}
                              >
                                <Minus size={16} />
                              </button>
                              <span className="w-8 text-center font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                className="p-1 hover:bg-white rounded-lg transition"
                              >
                                <Plus size={16} />
                              </button>
                            </div>

                            {/* Remove Button */}
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition"
                              title="Remove from cart"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm sticky top-20">
                <div className="p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-6">Order Summary</h2>

                  <div className="space-y-3">
                    {/* Subtotal */}
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotal</span>
                      <span className="font-semibold">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    {/* Shipping */}
                    <div className="flex justify-between text-slate-700">
                      <span>Shipping</span>
                      <span className="font-semibold text-slate-900">₹40.00</span>
                    </div>

                    {/* Tax */}
                    <div className="flex justify-between text-slate-700">
                      <span>Tax</span>
                      <span className="font-semibold text-green-600">Included</span>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 pt-3 mt-3">
                      <div className="flex justify-between text-lg">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="font-bold text-slate-900">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={handleCheckout}
                    className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors mt-6"
                  >
                    Proceed to Checkout
                  </button>

                  {/* Continue Shopping */}
                  <Link href="/products">
                    <button className="w-full border-2 border-slate-200 text-slate-900 py-3 rounded-xl font-semibold hover:border-slate-300 hover:bg-slate-50 transition-colors mt-3">
                      Continue Shopping
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
