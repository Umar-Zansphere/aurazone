'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Header from '@/app/components/Header';
import LoginPrompt from '@/components/LoginPrompt';
import { orderApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastContext';
import {
    ChevronLeft,
    Loader,
    AlertCircle,
    Package,
    Truck,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    CreditCard,
    Download,
    Ban
} from 'lucide-react';

const statusConfig = {
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package },
    SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Truck },
    DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

const orderTimeline = {
    PENDING: ['Order Placed'],
    PROCESSING: ['Order Placed', 'Processing'],
    SHIPPED: ['Order Placed', 'Processing', 'Shipped'],
    DELIVERED: ['Order Placed', 'Processing', 'Shipped', 'Delivered'],
    CANCELLED: ['Order Placed', 'Cancelled'],
};

export default function OrderDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isLoading: authLoading } = useAuth();
    const { showToast } = useToast();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (user && params.id) {
            fetchOrderDetail();
        } else if (!authLoading) {
            setLoading(false);
        }
    }, [user, authLoading, params.id]);

    const fetchOrderDetail = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await orderApi.getOrderDetail(params.id);
            const orderData = response.success ? response.data : response;
            console.log('Fetched order detail:', orderData);
            setOrder(orderData);
        } catch (err) {
            console.error('Error fetching order detail:', err);
            setError(err.message || 'Failed to load order details');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!window.confirm('Are you sure you want to cancel this order?')) {
            return;
        }

        try {
            setCancelling(true);
            await orderApi.cancelOrder(params.id, 'Customer requested cancellation');
            showToast('Order cancelled successfully', 'success');
            fetchOrderDetail(); // Refresh order data
        } catch (err) {
            console.error('Error cancelling order:', err);
            showToast(err.message || 'Failed to cancel order', 'error');
        } finally {
            setCancelling(false);
        }
    };

    const handleTrackOrder = () => {
        router.push(`/track-order/${order.trackingToken || order.id}`);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPrice = (price) => {
        return `₹${parseFloat(price).toLocaleString('en-IN')}`;
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                        <Loader className="animate-spin mx-auto mb-4 text-orange-500" size={32} />
                        <p className="text-slate-600">Loading order details...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50">
                <Header />
                <LoginPrompt
                    title="Order Details Access Required"
                    message="Please log in to view your order details and tracking information"
                />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center max-w-md">
                        <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
                        <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
                        <p className="text-slate-600 mb-6">{error || 'This order does not exist or you do not have permission to view it.'}</p>
                        <button
                            onClick={() => router.push('/orders')}
                            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                        >
                            Back to Orders
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const StatusIcon = statusConfig[order.status]?.icon || Package;
    const timeline = orderTimeline[order.status] || ['Order Placed'];
    const canCancel = order.status === 'PENDING' || order.status === 'PROCESSING';

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <Header />

            <div className="max-w-4xl mx-auto p-4 pt-6">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/orders')}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
                >
                    <ChevronLeft size={20} />
                    <span className="font-medium">Back to Orders</span>
                </button>

                {/* Order Header */}
                <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                Order #{order.orderNumber || order.id}
                            </h1>
                            <p className="text-slate-600">
                                Placed on {formatDate(order.createdAt)}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusIcon size={20} className={statusConfig[order.status]?.color.split(' ')[1]} />
                            <span className={`px-4 py-2 rounded-full text-sm font-medium border ${statusConfig[order.status]?.color || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                {statusConfig[order.status]?.label || order.status}
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        {order.status !== 'CANCELLED' && (
                            <button
                                onClick={handleTrackOrder}
                                className="flex-1 bg-orange-500 text-white px-4 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Truck size={20} />
                                Track Order
                            </button>
                        )}
                        {canCancel && (
                            <button
                                onClick={handleCancelOrder}
                                disabled={cancelling}
                                className="flex-1 bg-red-50 text-red-600 px-4 py-3 rounded-xl font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cancelling ? (
                                    <>
                                        <Loader className="animate-spin" size={20} />
                                        Cancelling...
                                    </>
                                ) : (
                                    <>
                                        <Ban size={20} />
                                        Cancel Order
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Order Timeline */}
                <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Order Timeline</h2>
                    <div className="space-y-4">
                        {timeline.map((step, index) => {
                            const isCompleted = index < timeline.length - 1 || order.status === 'DELIVERED';
                            const isCurrent = index === timeline.length - 1;

                            return (
                                <div key={step} className="flex items-start gap-4">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-orange-500' : 'bg-slate-200'
                                        }`}>
                                        {isCompleted ? (
                                            <CheckCircle className="text-white" size={16} />
                                        ) : (
                                            <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-white' : 'bg-slate-400'}`} />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {step}
                                        </p>
                                        {isCurrent && order.updatedAt && (
                                            <p className="text-sm text-slate-500 mt-1">
                                                {formatDate(order.updatedAt)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">
                        Items ({order.items?.length || 0})
                    </h2>
                    <div className="space-y-4">
                        {order.items?.map((item, index) => (
                            <div key={index} className="flex gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                                    {item.variant?.product?.images?.[0] ? (
                                        <Image
                                            src={item.variant.product.images[0]}
                                            alt={item.variant.product.name}
                                            width={80}
                                            height={80}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Package className="w-full h-full p-4 text-slate-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-900 mb-1">
                                        {item.variant?.product?.name || 'Product'}
                                    </h3>
                                    <p className="text-sm text-slate-600 mb-2">
                                        Size: {item.variant?.size} • Qty: {item.quantity}
                                    </p>
                                    <p className="font-bold text-slate-900">
                                        {formatPrice(item.price)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="text-slate-600" size={20} />
                        <h2 className="text-lg font-bold text-slate-900">Shipping Address</h2>
                    </div>
                    {order.address ? (
                        <div className="text-slate-700">
                            <p className="font-semibold">{order.address.name}</p>
                            <p>{order.address.addressLine1}</p>
                            {order.address.addressLine2 && <p>{order.address.addressLine2}</p>}
                            <p>{order.address.city}, {order.address.state} - {order.address.postalCode}</p>
                            <p>{order.address.country}</p>
                            {order.address.phone && <p className="mt-2">Phone: {order.address.phone}</p>}
                        </div>
                    ) : (
                        <p className="text-slate-600">No address information available</p>
                    )}
                </div>

                {/* Payment Summary */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="text-slate-600" size={20} />
                        <h2 className="text-lg font-bold text-slate-900">Payment Summary</h2>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-slate-700">
                            <span>Subtotal</span>
                            <span>{formatPrice(order.subtotal || order.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                            <span>Shipping</span>
                            <span className="font-medium text-slate-900">₹40.00</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                            <span>Tax</span>
                            <span className="text-green-600 font-medium">Included</span>
                        </div>
                        <div className="border-t border-slate-200 pt-2 mt-2">
                            <div className="flex justify-between text-lg font-bold text-slate-900">
                                <span>Total</span>
                                <span>{formatPrice(order.totalAmount + 40)}</span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200 mt-2">
                            <p className="text-sm text-slate-600">
                                Payment Method: <span className="font-medium text-slate-900">{order.paymentMethod || 'Razorpay'}</span>
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                                Payment Status: <span className={`font-medium ${order.paymentStatus === 'PAID' ? 'text-green-600' : 'text-orange-600'}`}>
                                    {order.paymentStatus || 'Pending'}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
