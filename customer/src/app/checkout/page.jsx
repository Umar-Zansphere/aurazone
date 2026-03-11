'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Plus, CreditCard, Truck, CheckCircle, Edit2 } from 'lucide-react';
import Header from '@/app/components/Header';
import { cartApi, orderApi, addressApi, paymentApi, productApi } from '@/lib/api';
import { useToast } from '@/components/ToastContext';
import { CartLoadingSkeleton } from '@/components/LoadingSkeleton';
import { useAuth } from '@/context/AuthContext';

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('cart');

  // Direct checkout params
  const isBuyNow = searchParams.get('buyNow') === 'true';
  const buyNowProductId = searchParams.get('productId');
  const buyNowVariantId = searchParams.get('variantId');
  const buyNowQty = parseInt(searchParams.get('qty') || '1', 10);

  // Guest user fields
  const [isGuest, setIsGuest] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState({
    name: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Use auth context to determine if user is logged in
        setIsGuest(!isAuthenticated);

        // Fetch user's addresses if logged in
        if (isAuthenticated) {
          try {
            const addressResponse = await addressApi.getAddresses();
            if (addressResponse) {
              setAddresses(addressResponse || []);
              // Select first address by default
              if (addressResponse && addressResponse.length > 0) {
                setSelectedAddressId(addressResponse[0].id);
              }
            }
          } catch (err) {
            console.error('Error fetching addresses:', err);
          }
        }

        // Get cart items OR Direct Buy item
        try {
          if (isBuyNow && buyNowProductId && buyNowVariantId) {
            // Fetch product to build a pseudo-cart
            const productRes = await productApi.getProductDetail(buyNowProductId);
            const productData = productRes.data || productRes;
            const singleVariant = productData.variants?.find(v => v.id === buyNowVariantId);

            if (singleVariant) {
              setCart([{
                id: 'direct-buy',
                variantId: singleVariant.id,
                quantity: buyNowQty,
                unitPrice: singleVariant.price,
                variant: {
                  ...singleVariant,
                  product: {
                    id: productData.id,
                    name: productData.name,
                    category: productData.category
                  }
                }
              }]);
            } else {
              showToast('Product variant not found', 'error');
            }
          } else {
            // Standard cart fetching
            const cartResponse = await cartApi.getCart();
            if (cartResponse) {
              setCart(cartResponse?.items || []);
            }
          }
        } catch (err) {
          console.error('Error fetching cart/product:', err);
          showToast('Failed to load items', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Failed to load checkout data', 'error');
        console.error('Error fetching checkout data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, showToast, isAuthenticated]);

  const validateGuestAddress = () => {
    if (!guestAddress.name || !guestAddress.email || !guestAddress.phone || !guestAddress.addressLine1 ||
      !guestAddress.city || !guestAddress.state || !guestAddress.postalCode) {
      showToast('Please fill in all required address fields', 'warning');
      return false;
    }
    if (guestAddress.phone.length !== 10) {
      showToast('Please enter a valid 10-digit phone number', 'warning');
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestAddress.email)) {
      showToast('Please enter a valid email address', 'warning');
      return false;
    }
    return true;
  };

  const handleCreateOrder = async () => {
    // Validation
    if (isGuest) {
      if (!validateGuestAddress()) return;
    } else {
      if (!selectedAddressId) {
        showToast('Please select a delivery address', 'warning');
        return;
      }
    }

    try {
      setSubmitting(true);

      // Step 1: Create order
      console.log('Creating order...');
      let response;

      if (isBuyNow) {
        if (isGuest) {
          response = await orderApi.createGuestDirectOrder(guestAddress, paymentMethod, buyNowVariantId, buyNowQty);
        } else {
          response = await orderApi.createDirectOrder(selectedAddressId, paymentMethod, buyNowVariantId, buyNowQty);
        }
      } else {
        if (isGuest) {
          // Guest order with address data
          response = await orderApi.createGuestOrder(guestAddress, paymentMethod);
        } else {
          // Logged-in user order
          response = await orderApi.createOrder(selectedAddressId, paymentMethod);
        }
      }

      if (!response.success) {
        showToast(response.message || 'Failed to create order', 'error');
        setSubmitting(false);
        return;
      }

      const orderData = response.data;
      console.log('Order created:', orderData);
      showToast('Order created successfully!', 'success');

      // Step 2: Determine next action based on payment method
      if (paymentMethod === 'COD') {
        // For COD, redirect to confirmation page
        const orderInfo = btoa(JSON.stringify({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          totalAmount: Number(orderData.totalAmount),
          paymentMethod: 'COD'
        }));
        router.push(`/order-confirmation?order=${orderInfo}`);
      } else if (paymentMethod === 'RAZORPAY') {
        // Initialize Razorpay payment
        const totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);
        const shippingFee = 40;
        const finalAmount = totalAmount + shippingFee;

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: Math.round(finalAmount * 100), // in paise
          currency: 'INR',
          name: 'Aurazone',
          description: `Order ${orderData.orderNumber}`,
          order_id: orderData.razorpayOrderId,
          handler: async (response) => {
            try {
              console.log('Payment response:', response);

              // Step 3: Verify payment signature
              const verifyResponse = await paymentApi.verifyPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );

              if (verifyResponse.success) {
                console.log('Payment verified successfully');
                showToast('Payment successful!', 'success');

                // Redirect to confirmation page
                const orderInfo = btoa(JSON.stringify({
                  orderId: orderData.orderId,
                  orderNumber: orderData.orderNumber,
                  totalAmount: Number(orderData.totalAmount),
                  paymentMethod: 'RAZORPAY'
                }));

                // Redirect based on user type
                if (isGuest) {
                  router.push(`/order-confirmation?order=${orderInfo}`);
                } else {
                  router.push(`/order-confirmation?order=${orderInfo}`);
                }
              } else {
                showToast('Payment verification failed', 'error');
                setSubmitting(false);
              }
            } catch (error) {
              console.error('Payment verification error:', error);
              showToast(error.message || 'Payment verification failed', 'error');
              setSubmitting(false);
            }
          },
          prefill: {
            email: guestAddress.email || '',
            contact: isGuest ? guestAddress.phone : ''
          },
          theme: {
            color: '#FF6B6B'
          },
          modal: {
            ondismiss: () => {
              console.log('Payment modal closed');
              setSubmitting(false);
              showToast('Payment cancelled. Please try again.', 'warning');
            }
          }
        };

        // Load Razorpay script if not already loaded
        if (!window.Razorpay) {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = () => {
            const rzp = new window.Razorpay(options);
            rzp.open();
          };
          document.body.appendChild(script);
        } else {
          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      }
    } catch (err) {
      showToast(err.message || 'Error creating order', 'error');
      console.error('Error creating order:', err);
      setSubmitting(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);
  const shippingFee = 40;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <CartLoadingSkeleton />
      </div>
    );
  }

  if (!cart || cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-orange-500" />
            <p className="text-slate-900 text-lg font-bold mb-4">Your cart is empty</p>
            <button
              onClick={() => router.push('/products')}
              className="px-6 py-3 min-h-11 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-colors font-bold touch-manipulation active:scale-95"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 min-w-11 min-h-11 hover:bg-slate-200 rounded-xl transition-colors touch-manipulation active:scale-95"
          >
            <ArrowLeft size={24} className="text-slate-700" />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Checkout</h1>
        </div>

        {/* Login Prompt for Guest Users */}
        {isGuest && (
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-3xl p-6">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <CheckCircle size={24} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2">Faster Checkout with Login</h3>
                <p className="text-blue-700 text-sm mb-4">
                  Log in or create an account to enjoy faster checkout, saved addresses, order tracking, and exclusive offers.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => router.push('/login?redirect=/checkout')}
                    className="px-6 py-2 min-h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors touch-manipulation active:scale-95"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => router.push('/signup?redirect=/checkout')}
                    className="px-6 py-2 min-h-10 bg-white hover:bg-blue-50 text-blue-600 font-semibold rounded-xl border-2 border-blue-200 transition-colors touch-manipulation active:scale-95"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cart Items */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Order Summary</h2>

              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={index} className="flex gap-4 pb-4 border-b border-slate-200 last:border-0">
                    {item.variant?.images?.[0]?.url && (
                      <div className="relative w-20 h-20 bg-slate-50 rounded-xl shrink-0">
                        <Image
                          src={item.variant.images[0].url}
                          alt={item.product?.name || 'Product'}
                          fill
                          sizes="80px"
                          className="object-contain rounded-xl"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900">{item.product?.name}</h3>
                      <p className="text-sm text-slate-600">
                        {item.variant?.color} • Size {item.variant?.size}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Quantity: <span className="font-semibold">{item.quantity}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        ₹{(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}
                      </p>
                      <p className="text-sm text-slate-500">
                        ₹{parseFloat(item.unitPrice).toFixed(2)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Truck size={24} className="text-orange-600" />
                  <h2 className="text-2xl font-bold text-slate-900">Delivery Address</h2>
                </div>
                {!isGuest && addresses.length > 0 && (
                  <button
                    onClick={() => router.push('/profile/addresses')}
                    className="flex items-center gap-2 px-4 py-2 min-h-11 text-sm font-semibold text-orange-600 hover:bg-orange-50 rounded-xl transition-colors touch-manipulation active:scale-95"
                  >
                    <Edit2 size={16} />
                    Manage
                  </button>
                )}
              </div>

              {isGuest ? (
                /* Guest Address Form */
                <div className="space-y-5">
                  <p className="text-sm text-slate-600">Please provide your delivery details. We&apos;ll use this information to confirm your order and coordinate delivery.</p>

                  {/* Contact Information Section */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <CreditCard size={18} className="text-orange-600" />
                      Contact Information
                    </h4>
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            placeholder="Enter your full name"
                            value={guestAddress.name}
                            onChange={(e) => setGuestAddress({ ...guestAddress, name: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            placeholder="you@example.com"
                            value={guestAddress.email}
                            onChange={(e) => setGuestAddress({ ...guestAddress, email: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          <p className="text-xs text-slate-500 mt-1">📧 We&apos;ll send order confirmation and tracking updates here</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                          Phone Number (10 digits) *
                        </label>
                        <input
                          type="tel"
                          placeholder="98765 43210"
                          value={guestAddress.phone}
                          onChange={(e) => setGuestAddress({ ...guestAddress, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">📱 Our delivery partner will contact you using this number for coordination</p>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Section */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Truck size={18} className="text-orange-600" />
                      Delivery Address
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                          Street Address Line 1 *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 123 Main Street"
                          value={guestAddress.addressLine1}
                          onChange={(e) => setGuestAddress({ ...guestAddress, addressLine1: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                          Street Address Line 2 (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Apartment, Suite, etc."
                          value={guestAddress.addressLine2}
                          onChange={(e) => setGuestAddress({ ...guestAddress, addressLine2: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            City *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Mumbai"
                            value={guestAddress.city}
                            onChange={(e) => setGuestAddress({ ...guestAddress, city: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            State *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Maharashtra"
                            value={guestAddress.state}
                            onChange={(e) => setGuestAddress({ ...guestAddress, state: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            PIN Code *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., 400001"
                            value={guestAddress.postalCode}
                            onChange={(e) => setGuestAddress({ ...guestAddress, postalCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    ⚠️ <span className="font-semibold">Please verify your details carefully</span> - Errors may cause delivery issues or order cancellation.
                  </p>
                </div>
              ) : addresses.length === 0 ? (
                /* No Addresses */
                <div className="text-center py-12 bg-linear-to-br from-slate-50 to-slate-100 rounded-2xl">
                  <Truck size={48} className="mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 mb-4 font-medium">No addresses found</p>
                  <p className="text-sm text-slate-500 mb-6">Please add an address to continue with checkout</p>
                  <button
                    onClick={() => router.push('/profile/addresses')}
                    className="px-6 py-3 min-h-11 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-colors inline-flex items-center gap-2 font-bold shadow-md hover:shadow-lg touch-manipulation active:scale-95"
                  >
                    <Plus size={20} />
                    Add New Address
                  </button>
                </div>
              ) : (
                /* Saved Addresses */
                <>
                  <div className="grid gap-3 mb-4">
                    {addresses.map((address) => (
                      <button
                        key={address.id}
                        onClick={() => setSelectedAddressId(address.id)}
                        className={`w-full p-4 border-2 rounded-2xl cursor-pointer transition-all text-left min-h-11 touch-manipulation active:scale-[0.98] ${selectedAddressId === address.id
                          ? 'border-orange-500 bg-white shadow-md'
                          : 'border-slate-200 hover:border-orange-300 bg-white hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex gap-3 items-start">
                          <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selectedAddressId === address.id
                            ? 'border-orange-500 bg-orange-500'
                            : 'border-slate-300'
                            }`}>
                            {selectedAddressId === address.id && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900">{address.name}</p>
                                <p className="text-sm text-slate-600 mt-1">
                                  {address.addressLine1}
                                  {address.addressLine2 && `, ${address.addressLine2}`}
                                </p>
                                <p className="text-sm text-slate-600">
                                  {address.city}, {address.state} {address.postalCode}
                                </p>
                                <p className="text-sm text-slate-600 mt-1">📞 {address.phone}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => router.push('/profile/addresses')}
                    className="w-full px-6 py-3 min-h-11 border-2 border-dashed border-orange-300 text-orange-600 rounded-2xl hover:bg-orange-50 transition-colors inline-flex items-center justify-center gap-2 font-semibold touch-manipulation active:scale-95"
                  >
                    <Plus size={20} />
                    Add Another Address
                  </button>
                </>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <CreditCard size={24} className="text-orange-600" />
                <h2 className="text-2xl font-bold text-slate-900">Payment Method</h2>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('RAZORPAY')}
                  className={`w-full p-4 border-2 rounded-xl cursor-pointer transition-all text-left min-h-11 touch-manipulation active:scale-[0.98] ${paymentMethod === 'RAZORPAY'
                    ? 'border-orange-500 bg-slate-50 shadow-md'
                    : 'border-slate-200 hover:border-orange-300 bg-white hover:bg-slate-50'
                    }`}
                >
                  <div className="flex gap-3 items-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMethod === 'RAZORPAY'
                      ? 'border-orange-500 bg-orange-500'
                      : 'border-slate-300'
                      }`}>
                      {paymentMethod === 'RAZORPAY' && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={20} className="text-orange-600" />
                        <p className="font-bold text-slate-900">Online Payment</p>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">Pay securely using credit/debit card, netbanking, or UPI</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('COD')}
                  className={`w-full p-4 border-2 rounded-xl cursor-pointer transition-all text-left min-h-11 touch-manipulation active:scale-[0.98] ${paymentMethod === 'COD'
                    ? 'border-orange-500 bg-slate-50 shadow-md'
                    : 'border-slate-200 hover:border-orange-300 bg-white hover:bg-slate-50'
                    }`}
                >
                  <div className="flex gap-3 items-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMethod === 'COD'
                      ? 'border-orange-500 bg-orange-500'
                      : 'border-slate-300'
                      }`}>
                      {paymentMethod === 'COD' && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Truck size={20} className="text-green-600" />
                        <p className="font-bold text-slate-900">Cash on Delivery</p>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">Pay when you receive your order at the door</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

          </div>

          {/* Sidebar - Order Total */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 sticky top-24 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Order Total</h3>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold text-slate-900">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Shipping</span>
                  <span className="font-semibold text-slate-900">₹40.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax</span>
                  <span className="font-semibold text-green-600">Included</span>
                </div>

                <div className="border-t-2 border-slate-200 pt-4 flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="text-3xl font-black text-orange-600">
                    ₹{(cartTotal + shippingFee).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCreateOrder}
                disabled={submitting || (!isGuest && !selectedAddressId && addresses.length === 0)}
                className="w-full px-6 py-4 min-h-11 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none touch-manipulation active:scale-95 disabled:active:scale-100"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Place Order
                    <span className="text-lg">→</span>
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center mt-4">
                By placing an order, you agree to our<br />
                <span className="font-semibold">
                  <Link href="/terms-and-conditions" className="hover:text-orange-600 transition-colors">
                    Terms & Conditions
                  </Link>
                  {' '}|{' '}
                  <Link href="/shipping" className="hover:text-orange-600 transition-colors">
                    Shipping
                  </Link>
                  {' '}|{' '}
                  <Link href="/cancellations-and-refunds" className="hover:text-orange-600 transition-colors">
                    Cancellations & Refunds
                  </Link>
                  {' '}|{' '}
                  <Link href="/privacy" className="hover:text-orange-600 transition-colors">
                    Privacy
                  </Link>
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
