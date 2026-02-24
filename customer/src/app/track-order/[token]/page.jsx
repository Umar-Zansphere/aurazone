'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Package, CheckCircle } from 'lucide-react';
import Header from '@/app/components/Header';
import { orderApi } from '@/lib/api';
import { useToast } from '@/components/ToastContext';

export default function TrackOrderPage() {
    const router = useRouter();
    const params = useParams();

    const { showToast } = useToast();

    const [trackingToken, setTrackingToken] = useState(params.token || '');
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

                            {/* Status Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Order Date */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Order Date</p>
                                    <p className="text-lg font-bold text-gray-900">
                                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>

                                {/* Order Status */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Order Status</p>
                                    <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold border-2 ${getStatusColor(order.status)}`}>
                                        {order.status}
                                    </span>
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

                                {/* Total Amount */}
                                <div className="bg-orange-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Amount</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        ₹{parseFloat(order.totalAmount).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Order Items</h3>
                                <div className="space-y-4">
                                    {order.items && order.items.length > 0 ? (
                                        order.items.map((item) => (
                                            <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-gray-900">{item.productName}</h4>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            <span className="font-semibold">Size:</span> {item.size} | <span className="font-semibold">Color:</span> {item.color}
                                                        </p>
                                                        {item.variant?.sku && (
                                                            <p className="text-sm text-gray-500 mt-1">SKU: {item.variant.sku}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-gray-900">₹{parseFloat(item.price).toFixed(2)}</p>
                                                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                                                    </div>
                                                </div>
                                                <div className="border-t border-gray-200 pt-3">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Subtotal</span>
                                                        <span className="font-semibold text-gray-900">₹{parseFloat(item.subtotal).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-600">No items found</p>
                                    )}
                                </div>
                            </div>

                            {/* Shipment Information */}
                            <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Shipment Status</h3>
                                {order.shipments && order.shipments.length > 0 ? (
                                    <div className="space-y-4">
                                        {order.shipments.map((shipment, idx) => (
                                            <div key={shipment.id} className="bg-white rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-semibold text-gray-900">Shipment {idx + 1}</p>
                                                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${shipment.status === 'SHIPPED' ? 'bg-purple-100 text-purple-800' :
                                                                shipment.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                                                                    shipment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {shipment.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                {shipment.courierName && (
                                                    <div className="mb-3">
                                                        <p className="text-sm text-gray-600"><span className="font-semibold">Courier:</span> {shipment.courierName}</p>
                                                    </div>
                                                )}

                                                {shipment.trackingNumber ? (
                                                    <div className="bg-blue-100 rounded-lg p-3 mb-3">
                                                        <p className="text-xs font-semibold text-blue-900 mb-2">Tracking Number</p>
                                                        <p className="font-mono text-blue-900 text-center font-bold">{shipment.trackingNumber}</p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-yellow-50 rounded-lg p-3 mb-3 border border-yellow-200">
                                                        <p className="text-sm text-yellow-800">Tracking number will be available once the package is shipped.</p>
                                                    </div>
                                                )}

                                                {shipment.shippedAt && (
                                                    <p className="text-sm text-gray-600">
                                                        <span className="font-semibold">Shipped on:</span> {new Date(shipment.shippedAt).toLocaleDateString('en-IN', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                )}

                                                {shipment.trackingUrl && (
                                                    <a
                                                        href={shipment.trackingUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-block w-full text-center mt-3 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Track on Courier Website →
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-600">No shipment information available yet.</p>
                                )}
                            </div>

                            {/* Delivery Address */}
                            {order.orderAddress && (
                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Delivery Address</h3>
                                    <div className="space-y-2 text-gray-700">
                                        <p className="font-semibold text-gray-900">{order.orderAddress.name}</p>
                                        <p>{order.orderAddress.addressLine1}</p>
                                        {order.orderAddress.addressLine2 && <p>{order.orderAddress.addressLine2}</p>}
                                        <p>{order.orderAddress.city}, {order.orderAddress.state} {order.orderAddress.postalCode}</p>
                                        <p>{order.orderAddress.country}</p>
                                        <div className="border-t border-slate-300 pt-3 mt-3">
                                            <p className="text-sm"><span className="font-semibold">Phone:</span> {order.orderAddress.phone}</p>
                                            <p className="text-sm"><span className="font-semibold">Email:</span> {order.orderAddress.email}</p>
                                        </div>
                                    </div>
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
