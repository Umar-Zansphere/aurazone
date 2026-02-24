'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Package, Truck, Mail, Home } from 'lucide-react';
import Header from '@/app/components/Header';

function OrderConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    try {
      const orderParam = searchParams.get('order');
      if (orderParam) {
        const decoded = JSON.parse(atob(orderParam));
        setOrderData(decoded);
      }
    } catch (error) {
      console.error('Error decoding order data:', error);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
            <p className="text-slate-600 mb-6">Unable to load order details</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 min-h-11 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-colors font-bold touch-manipulation active:scale-95"
            >
              Go to Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
        {/* Success Card */}
        <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center mb-8 shadow-sm">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse"></div>
              <CheckCircle size={80} className="text-green-600 relative z-10" />
            </div>
          </div>

          <h1 className="text-4xl font-black text-slate-900 mb-2">Order Confirmed!</h1>
          <p className="text-lg text-slate-600 mb-8">Thank you for your order. We're preparing your shoes with care.</p>

          {/* Order Number */}
          <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-2xl p-6 mb-8">
            <p className="text-slate-600 mb-2">Order Number</p>
            <p className="text-4xl font-black text-orange-600 font-mono">{orderData.orderNumber}</p>
            <p className="text-sm text-slate-500 mt-2">Order ID: {orderData.orderId}</p>
          </div>

          {/* Order Summary */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-slate-600 mb-2">Total Amount</p>
              <p className="text-3xl font-black text-slate-900">₹{parseFloat(orderData.totalAmount).toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Includes Tax & Shipping</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-slate-600 mb-2">Payment Method</p>
              <p className="text-2xl font-bold text-slate-900">
                {orderData.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}
              </p>
            </div>
          </div>

          {/* Next Steps */}
          <div className="border-t-2 border-slate-200 pt-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">What's Next?</h2>

            <div className="grid md:grid-cols-2 gap-4 text-left">
              {/* Order Confirmation */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex gap-3">
                  <Mail size={24} className="text-blue-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">Order Confirmation</h3>
                    <p className="text-sm text-slate-600">Check your email for order details and tracking information</p>
                  </div>
                </div>
              </div>

              {/* Shipping */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                <div className="flex gap-3">
                  <Truck size={24} className="text-indigo-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">Shipping Soon</h3>
                    <p className="text-sm text-slate-600">Your order will be shipped within 24-48 hours</p>
                  </div>
                </div>
              </div>

              {/* Track Order */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                <div className="flex gap-3">
                  <Package size={24} className="text-purple-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">Track Your Order</h3>
                    <p className="text-sm text-slate-600">Monitor your shipment status in real-time</p>
                  </div>
                </div>
              </div>

              {/* Delivery */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex gap-3">
                  <Home size={24} className="text-green-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">Fast Delivery</h3>
                    <p className="text-sm text-slate-600">Expect delivery within 5-7 business days</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COD Notice */}
        {orderData.paymentMethod === 'COD' && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8">
            <div className="flex gap-3">
              <div className="text-2xl">📝</div>
              <div>
                <h3 className="font-bold text-amber-900 mb-2">Cash on Delivery</h3>
                <p className="text-sm text-amber-800">
                  Please have the exact amount (₹{parseFloat(orderData.totalAmount).toFixed(2)}) ready when our delivery agent arrives at your doorstep.
                  We accept cash payment only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/products')}
            className="px-6 py-4 min-h-11 border-2 border-orange-600 text-orange-600 rounded-2xl hover:bg-orange-50 transition-colors font-bold touch-manipulation active:scale-95"
          >
            Continue Shopping
          </button>
          {/* <button
            onClick={() => router.push('/orders')}
            className="px-6 py-4 min-h-11 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-colors font-bold shadow-md hover:shadow-lg touch-manipulation active:scale-95"
          >
            View All Orders
          </button> */}
        </div>

        {/* Support Info */}
        <div className="mt-12 bg-slate-100 rounded-2xl p-6 text-center">
          <h3 className="font-bold text-slate-900 mb-2">Need Help?</h3>
          <p className="text-slate-600 mb-4">
            If you have any questions about your order, please contact our customer support team.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="mailto:support@shoeShop.com"
              className="text-orange-600 font-semibold hover:text-orange-700 transition-colors"
            >
              📧 Email Support
            </a>
            <span className="text-slate-400">•</span>
            <a
              href="tel:+919876543210"
              className="text-orange-600 font-semibold hover:text-orange-700 transition-colors"
            >
              📞 Call Us
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  );

}
