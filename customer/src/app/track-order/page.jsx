'use client';

import { Suspense } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertCircle,
    CheckCircle2,
    CircleDot,
    Copy,
    CreditCard,
    MapPin,
    Package,
    Search,
    Truck,
    XCircle,
} from 'lucide-react';
import Header from '@/app/components/Header';
import { orderApi } from '@/lib/api';
import { useToast } from '@/components/ToastContext';

const ORDER_STATUS_META = {
    PENDING: {
        label: 'Pending',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    SUCCESS: {
        label: 'Confirmed',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    PAID: {
        label: 'Paid',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    SHIPPED: {
        label: 'Shipped',
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    DELIVERED: {
        label: 'Delivered',
        className: 'bg-green-50 text-green-700 border-green-200',
    },
    FAILED: {
        label: 'Payment Failed',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    CANCELLED: {
        label: 'Cancelled',
        className: 'bg-red-50 text-red-700 border-red-200',
    },
};

const PAYMENT_STATUS_META = {
    PENDING: {
        label: 'Pending',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    SUCCESS: {
        label: 'Paid',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    FAILED: {
        label: 'Failed',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
    },
};

const SHIPMENT_STATUS_META = {
    PENDING: {
        label: 'Preparing Shipment',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    SHIPPED: {
        label: 'In Transit',
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    DELIVERED: {
        label: 'Delivered',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    RETURNED: {
        label: 'Returned',
        className: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    LOST: {
        label: 'Issue in Transit',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
    },
};

const formatCurrency = (amount) => {
    const value = Number(amount || 0);
    return `₹${value.toFixed(2)}`;
};

const formatDateTime = (value) => {
    if (!value) {
        return 'N/A';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }
    return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getMeta = (map, key, fallbackLabel = 'Unknown') => {
    return map[key] || {
        label: key || fallbackLabel,
        className: 'bg-slate-50 text-slate-700 border-slate-200',
    };
};

const buildTrackingSteps = (order, latestShipment) => {
    const shipmentStatus = latestShipment?.status;
    const isShipmentCreated = Boolean(latestShipment);
    const isShipped = shipmentStatus === 'SHIPPED' || shipmentStatus === 'DELIVERED';
    const isDelivered = shipmentStatus === 'DELIVERED' || order.status === 'DELIVERED';
    const isPaymentDone = order.paymentStatus === 'SUCCESS';

    return [
        {
            id: 'placed',
            label: 'Order Placed',
            description: `Created on ${formatDateTime(order.createdAt)}`,
            done: true,
        },
        {
            id: 'paid',
            label: 'Payment Confirmed',
            description: isPaymentDone ? 'Payment has been received' : 'Awaiting payment confirmation',
            done: isPaymentDone,
        },
        {
            id: 'shipped',
            label: 'Shipped',
            description: isShipped
                ? `Shipped via ${latestShipment?.courierName || 'assigned courier'}`
                : isShipmentCreated
                    ? 'Shipment record created, waiting to dispatch'
                    : 'Shipment not created yet',
            done: isShipped,
        },
        {
            id: 'delivered',
            label: 'Delivered',
            description: isDelivered ? 'Package has been delivered' : 'Delivery in progress',
            done: isDelivered,
        },
    ];
};

function TrackOrderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();

    const tokenFromQuery = useMemo(() => searchParams.get('token') || '', [searchParams]);

    const [trackingToken, setTrackingToken] = useState(tokenFromQuery);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);

    const trackByToken = useCallback(async (token, options = {}) => {
        const trimmedToken = (token || '').trim();
        if (!trimmedToken) {
            showToast('Please enter a tracking token', 'warning');
            return;
        }

        try {
            setLoading(true);
            const response = await orderApi.trackOrderByToken(trimmedToken);

            if (response.success) {
                setOrder(response.data);
                if (options.showSuccessToast) {
                    showToast('Order found', 'success');
                }
            } else {
                showToast(response.message || 'Order not found', 'error');
            }
        } catch (err) {
            showToast(err.message || 'Error tracking order', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        setTrackingToken(tokenFromQuery || '');
        if (tokenFromQuery.trim()) {
            trackByToken(tokenFromQuery);
        }
    }, [tokenFromQuery, trackByToken]);

    const handleTrackByToken = (e) => {
        if (e) {
            e.preventDefault();
        }
        trackByToken(trackingToken, { showSuccessToast: true });
    };

    const latestShipment = useMemo(() => {
        if (!order?.shipments?.length) {
            return null;
        }
        return [...order.shipments]
            .filter((shipment) => !shipment.deletedAt)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    }, [order]);

    const timeline = useMemo(() => {
        if (!order) {
            return [];
        }
        return buildTrackingSteps(order, latestShipment);
    }, [order, latestShipment]);

    const orderStatusMeta = getMeta(ORDER_STATUS_META, order?.status);
    const paymentStatusMeta = getMeta(PAYMENT_STATUS_META, order?.paymentStatus);
    const shipmentStatusMeta = getMeta(SHIPMENT_STATUS_META, latestShipment?.status, 'Not Started');

    const itemSubtotal = useMemo(() => {
        if (!order?.items?.length) {
            return 0;
        }
        return order.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    }, [order]);

    const totalAmount = Number(order?.totalAmount || 0);
    const additionalCharges = Math.max(totalAmount - itemSubtotal, 0);

    const copyOrderNumber = async () => {
        if (!order?.orderNumber) {
            return;
        }
        try {
            await navigator.clipboard.writeText(order.orderNumber);
            showToast('Order number copied', 'success');
        } catch {
            showToast('Unable to copy order number', 'warning');
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-orange-50 flex flex-col">
            <Header />

            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-100 overflow-hidden">
                    <div className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 text-white">
                        <div className="max-w-3xl">
                            <p className="text-xs uppercase tracking-[0.22em] text-orange-200 mb-2">Live Order Tracking</p>
                            <h1 className="text-3xl sm:text-4xl font-black mb-2">Track Your Order</h1>
                            <p className="text-slate-200 text-sm sm:text-base">
                                View real-time payment, shipment, and delivery updates with one tracking token.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8 space-y-8">
                        <form onSubmit={handleTrackByToken} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                            <div className="flex flex-col lg:flex-row gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-2">
                                        Tracking Token
                                    </label>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={trackingToken}
                                            onChange={(e) => setTrackingToken(e.target.value)}
                                            placeholder="Paste your tracking token"
                                            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Found in your confirmation email after checkout.
                                    </p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !trackingToken.trim()}
                                    className="lg:self-end h-12 px-6 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Tracking...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={16} />
                                            Track
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {loading && !order && (
                            <div className="rounded-2xl border border-slate-200 p-10 text-center">
                                <div className="mx-auto w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4" />
                                <p className="text-slate-600">Fetching order details...</p>
                            </div>
                        )}

                        {!loading && !order && (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                                <Package size={42} className="mx-auto text-slate-400 mb-4" />
                                <h2 className="text-xl font-bold text-slate-900 mb-2">No order loaded yet</h2>
                                <p className="text-slate-600 text-sm sm:text-base">
                                    Enter your token above to open the full tracking dashboard for your order.
                                </p>
                                <button
                                    onClick={() => router.push('/products')}
                                    className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors"
                                >
                                    Shop Products
                                </button>
                            </div>
                        )}

                        {order && (
                            <div className="space-y-6">
                                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">Order Snapshot</p>
                                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{order.orderNumber}</h2>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${orderStatusMeta.className}`}>
                                                    <CircleDot size={12} />
                                                    {orderStatusMeta.label}
                                                </span>
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${paymentStatusMeta.className}`}>
                                                    <CreditCard size={12} />
                                                    Payment: {paymentStatusMeta.label}
                                                </span>
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${shipmentStatusMeta.className}`}>
                                                    <Truck size={12} />
                                                    Shipment: {shipmentStatusMeta.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 min-w-[250px]">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Order Number</p>
                                                <button
                                                    type="button"
                                                    onClick={copyOrderNumber}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-orange-600"
                                                >
                                                    <Copy size={12} />
                                                    Copy
                                                </button>
                                            </div>
                                            <p className="font-mono text-sm text-slate-900 break-all mt-1">{order.orderNumber}</p>
                                            <p className="text-xs text-slate-500 mt-3">Placed: {formatDateTime(order.createdAt)}</p>
                                            <p className="text-xs text-slate-500 mt-1">Order ID: {order.orderId}</p>
                                        </div>
                                    </div>
                                </section>

                                {(order.status === 'FAILED' || order.status === 'CANCELLED') && (
                                    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${order.status === 'FAILED' ? 'bg-rose-50 border-rose-200' : 'bg-red-50 border-red-200'}`}>
                                        {order.status === 'FAILED' ? (
                                            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                                        ) : (
                                            <XCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                                        )}
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                {order.status === 'FAILED' ? 'Payment failed for this order' : 'This order was cancelled'}
                                            </p>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {order.status === 'FAILED'
                                                    ? 'Please place a new order or contact support for payment issues.'
                                                    : 'If this was unexpected, contact support with your order number.'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-4">Progress Timeline</p>
                                    <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {timeline.map((step) => (
                                            <li
                                                key={step.id}
                                                className={`rounded-xl border p-4 ${step.done ? 'bg-white border-emerald-200' : 'bg-white border-slate-200'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    {step.done ? (
                                                        <CheckCircle2 size={16} className="text-emerald-600" />
                                                    ) : (
                                                        <CircleDot size={16} className="text-slate-400" />
                                                    )}
                                                    <p className="font-semibold text-slate-900 text-sm">{step.label}</p>
                                                </div>
                                                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </section>

                                <div className="grid xl:grid-cols-3 gap-5">
                                    <section className="xl:col-span-2 rounded-2xl border border-slate-200 p-5 sm:p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-bold text-slate-900">Items</h3>
                                            <p className="text-xs text-slate-500 uppercase tracking-[0.16em]">{order.items?.length || 0} items</p>
                                        </div>

                                        <div className="space-y-3">
                                            {order.items?.length ? (
                                                order.items.map((item) => (
                                                    <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                            <div>
                                                                <h4 className="font-semibold text-slate-900">{item.productName}</h4>
                                                                <p className="text-sm text-slate-600 mt-1">
                                                                    {item.color} · {item.size}
                                                                </p>
                                                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                                    {item.variant?.product?.brand && (
                                                                        <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-slate-700">
                                                                            {item.variant.product.brand}
                                                                        </span>
                                                                    )}
                                                                    {item.variant?.product?.category && (
                                                                        <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-slate-700">
                                                                            {item.variant.product.category}
                                                                        </span>
                                                                    )}
                                                                    {item.variant?.sku && (
                                                                        <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-slate-700">
                                                                            SKU: {item.variant.sku}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="sm:text-right">
                                                                <p className="text-slate-900 font-semibold">{formatCurrency(item.price)}</p>
                                                                <p className="text-sm text-slate-600">Qty: {item.quantity}</p>
                                                                <p className="text-sm font-semibold text-orange-700 mt-1">{formatCurrency(item.subtotal)}</p>
                                                            </div>
                                                        </div>
                                                    </article>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-600">No line items found for this order.</p>
                                            )}
                                        </div>
                                    </section>

                                    <aside className="space-y-5">
                                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                            <h3 className="text-base font-bold text-slate-900 mb-4">Amount Summary</h3>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center justify-between text-slate-600">
                                                    <span>Items total</span>
                                                    <span>{formatCurrency(itemSubtotal)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-slate-600">
                                                    <span>Shipping & fees</span>
                                                    <span>{formatCurrency(additionalCharges)}</span>
                                                </div>
                                                <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900">
                                                    <span>Grand total</span>
                                                    <span>{formatCurrency(totalAmount)}</span>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-2xl border border-slate-200 p-5">
                                            <h3 className="text-base font-bold text-slate-900 mb-4">Shipment</h3>
                                            {latestShipment ? (
                                                <div className="space-y-3 text-sm">
                                                    <div>
                                                        <p className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Status</p>
                                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${shipmentStatusMeta.className}`}>
                                                            {shipmentStatusMeta.label}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Courier</p>
                                                        <p className="text-slate-800">{latestShipment.courierName || 'Will be assigned soon'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Tracking Number</p>
                                                        <p className="text-slate-800 font-mono break-all">
                                                            {latestShipment.trackingNumber || 'Not generated yet'}
                                                        </p>
                                                    </div>
                                                    {latestShipment.shippedAt && (
                                                        <div>
                                                            <p className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Shipped On</p>
                                                            <p className="text-slate-800">{formatDateTime(latestShipment.shippedAt)}</p>
                                                        </div>
                                                    )}
                                                    {latestShipment.trackingUrl && (
                                                        <a
                                                            href={latestShipment.trackingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 text-white px-4 py-2.5 font-semibold hover:bg-indigo-700 transition-colors"
                                                        >
                                                            Open Courier Tracking
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-600">
                                                    Shipment details are not available yet.
                                                </p>
                                            )}
                                        </section>
                                    </aside>
                                </div>

                                {order.orderAddress && (
                                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <MapPin size={16} className="text-orange-600" />
                                            <h3 className="text-base font-bold text-slate-900">Delivery Address</h3>
                                        </div>
                                        <div className="text-sm text-slate-700 space-y-1.5">
                                            <p className="font-semibold text-slate-900">{order.orderAddress.name}</p>
                                            <p>{order.orderAddress.addressLine1}</p>
                                            {order.orderAddress.addressLine2 && <p>{order.orderAddress.addressLine2}</p>}
                                            <p>
                                                {order.orderAddress.city}, {order.orderAddress.state} {order.orderAddress.postalCode}
                                            </p>
                                            <p>{order.orderAddress.country}</p>
                                            <div className="pt-3 mt-3 border-t border-slate-200 grid sm:grid-cols-2 gap-2">
                                                <p><span className="font-semibold">Phone:</span> {order.orderAddress.phone || 'N/A'}</p>
                                                <p><span className="font-semibold">Email:</span> {order.orderAddress.email || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                <div className="grid sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setOrder(null);
                                            setTrackingToken('');
                                            router.replace('/track-order');
                                        }}
                                        className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        Track Another Order
                                    </button>
                                    <button
                                        onClick={() => router.push('/products')}
                                        className="rounded-xl bg-orange-600 text-white px-5 py-3 font-semibold hover:bg-orange-700 transition-colors"
                                    >
                                        Continue Shopping
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-center mt-8 text-sm text-slate-600">
                    <p>
                        Need help with delivery? Contact us at{' '}
                        <span className="font-semibold">support@aurazone.com</span>
                    </p>
                </div>
            </main>
        </div>
    );
}

export default function TrackOrderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-orange-50 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
                </div>
            </div>
        }>
            <TrackOrderContent />
        </Suspense>
    );
}
