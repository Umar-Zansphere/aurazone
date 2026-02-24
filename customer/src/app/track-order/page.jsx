'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, CheckCircle } from 'lucide-react';
import Header from '@/app/components/Header';
import { orderApi } from '@/lib/api';
import { useToast } from '@/components/ToastContext';

function TrackOrderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();

    const [trackingToken, setTrackingToken] = useState(searchParams.get('token') || '');
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);

    // If tracking token is provided in URL, auto-load order
    useEffect(() => {
        if (trackingToken && trackingToken.trim()) {
            handleTrackByToken();
        }
    }, []);

    const handleTrackByToken = async (e) => {
        if (e) e.preventDefault();

        if (!trackingToken || !trackingToken.trim()) {
            showToast('Please enter a tracking token', 'warning');
            return;
        }

        try {
            setLoading(true);
            const response = await orderApi.trackOrderByToken(trackingToken.trim());

            if (response.success) {
                setOrder(response.data);
                showToast('Order found!', 'success');
            } else {
                showToast(response.message || 'Order not found', 'error');
            }
        } catch (err) {
            showToast(err.message || 'Error tracking order', 'error');
        } finally {
            setLoading(false);
        }
    };


    const getStatusColor = (status) => {
        switch (status) {
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'PAID':
                return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'SHIPPED':
                return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'DELIVERED':
                return 'bg-green-100 text-green-800 border-green-300';
            case 'CANCELLED':
                return 'bg-red-100 text-red-800 border-red-300';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex flex-col">
            <Header />

            <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-12 w-full">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-lg">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
                            <Package size={32} className="text-orange-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
                        <p className="text-gray-600">Enter your tracking token to view order status and details</p>
                    </div>

                    {/* Order Tracking Input or Details */}
                    {!order ? (
                        <form onSubmit={handleTrackByToken} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Tracking Token
                                </label>
                                <input
                                    type="text"
                                    value={trackingToken}
                                    onChange={(e) => setTrackingToken(e.target.value)}
                                    placeholder="Enter your tracking token"
                                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                                    required
                                />
                                <p className="text-sm text-gray-500 mt-2">
                                    You received this token in your order confirmation email
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !trackingToken.trim()}
                                className="w-full px-6 py-4 min-h-11 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg hover:shadow-xl touch-manipulation active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Tracking Order...
                                    </>
                                ) : (
                                    <>
                                        Track Order
                                        <span className="text-lg">→</span>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-8">
                            {/* Success Banner */}
                            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                                <CheckCircle size={48} className="mx-auto mb-3 text-green-600" />
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">Order Found!</h2>
                                <p className="text-gray-600 font-mono text-sm">{order.orderNumber}</p>
                            </div>

                            {/* Order Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Order Date */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Order Date</p>
                                    <p className="text-lg font-bold text-gray-900">
                                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>

                                {/* Order Status */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</p>
                                    <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold border-2 ${status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                            status === 'PAID' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                                status === 'SHIPPED' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                                    status === 'DELIVERED' ? 'bg-green-100 text-green-800 border-green-300' :
                                                        status === 'CANCELLED' ? 'bg-red-100 text-red-800 border-red-300' :
                                                            'bg-gray-100 text-gray-800 border-gray-300'
                                        }`}>
                                        {order.status}
                                    </span>
                                </div>

                                {/* Total Amount */}
                                <div className="bg-orange-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Amount</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        ₹{parseFloat(order.totalAmount).toFixed(2)}
                                    </p>
                                </div>

                                {/* Payment Status */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment Status</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${order.paymentStatus === 'SUCCESS'
                                        ? 'bg-green-100 text-green-800'
                                        : order.paymentStatus === 'PENDING'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                        {order.paymentStatus}
                                    </span>
                                </div>
                            </div>

                            {/* Tracking Info */}
                            {order.shipment && order.shipment.trackingNumber && (
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                                    <p className="text-sm font-bold text-blue-900 mb-3">Courier Tracking</p>
                                    <p className="text-blue-700 font-mono text-center text-lg mb-3 bg-white rounded-lg p-3">
                                        {order.shipment.trackingNumber}
                                    </p>
                                    {order.shipment.trackingUrl && (
                                        <a
                                            href={order.shipment.trackingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block w-full text-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Track on Courier Website
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setOrder(null);
                                        setTrackingToken('');
                                    }}
                                    className="w-full px-6 py-3 min-h-11 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors touch-manipulation active:scale-95"
                                >
                                    Track Another Order
                                </button>
                                <button
                                    onClick={() => router.push('/products')}
                                    className="w-full px-6 py-3 min-h-11 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium transition-colors touch-manipulation active:scale-95"
                                >
                                    Continue Shopping
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Help Text */}
                <div className="text-center mt-8 text-sm text-gray-600">
                    <p>Need help? Contact us at <span className="font-semibold">support@solemate.com</span></p>
                </div>
            </main>
        </div>
    );
}

export default function TrackOrderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
                </div>
            </div>
        }>
            <TrackOrderContent />
        </Suspense>
    );
}
