'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import LoginPrompt from '@/components/LoginPrompt';
import { orderApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
    Package,
    Search,
    Loader,
    ChevronRight,
    AlertCircle,
    ShoppingBag,
    Truck,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';

const statusConfig = {
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800', icon: Package },
    SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-800', icon: Truck },
    DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function OrdersPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (user) {
            fetchOrders();
        } else if (!authLoading) {
            setLoading(false);
        }
    }, [user, authLoading]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await orderApi.getOrders();
            const ordersList = response.data?.orders || [];
            setOrders(Array.isArray(ordersList) ? ordersList : []);
            setFilteredOrders(Array.isArray(ordersList) ? ordersList : []);
        } catch (err) {
            console.error('Error fetching orders:', err);
            setError(err.message || 'Failed to load orders');
            setOrders([]);
            setFilteredOrders([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter orders by status and search
    useEffect(() => {
        let result = [...orders];

        // Filter by status
        if (selectedStatus !== 'ALL') {
            result = result.filter(order => order.status === selectedStatus);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            result = result.filter(order =>
                order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.id?.toString().includes(searchQuery)
            );
        }

        setFilteredOrders(result);
    }, [selectedStatus, searchQuery, orders]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
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
                        <p className="text-slate-600">Loading orders...</p>
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
                    title="Orders Access Required"
                    message="Please log in to view your order history and track your orders"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <Header />

            <div className="max-w-4xl mx-auto p-4 pt-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">My Orders</h1>
                    <p className="text-slate-600">View and track your orders</p>
                </div>

                {/* Search Bar */}
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by order number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Status Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                    {['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${selectedStatus === status
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {status === 'ALL' ? 'All Orders' : statusConfig[status]?.label || status}
                        </button>
                    ))}
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-semibold text-red-900 mb-1">Error Loading Orders</h3>
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    </div>
                )}

                {/* Orders List */}
                {!error && filteredOrders.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <ShoppingBag className="mx-auto mb-4 text-slate-300" size={64} />
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            {searchQuery || selectedStatus !== 'ALL' ? 'No orders found' : 'No orders yet'}
                        </h3>
                        <p className="text-slate-600 mb-6">
                            {searchQuery || selectedStatus !== 'ALL'
                                ? 'Try adjusting your filters or search query'
                                : 'Start shopping to see your orders here'}
                        </p>
                        {!searchQuery && selectedStatus === 'ALL' && (
                            <button
                                onClick={() => router.push('/products')}
                                className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                            >
                                Browse Products
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map((order) => {
                            const StatusIcon = statusConfig[order.status]?.icon || Package;

                            return (
                                <div
                                    key={order.id}
                                    onClick={() => router.push(`/orders/${order.id}`)}
                                    className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 mb-1">
                                                Order #{order.orderNumber || order.id}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {formatDate(order.createdAt)}
                                            </p>
                                        </div>
                                        <ChevronRight className="text-slate-400 flex-shrink-0" size={20} />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <StatusIcon size={16} className={statusConfig[order.status]?.color.split(' ')[1]} />
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[order.status]?.color || 'bg-slate-100 text-slate-800'}`}>
                                                {statusConfig[order.status]?.label || order.status}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-slate-600">Total</p>
                                            <p className="font-bold text-slate-900">{formatPrice(order.totalAmount)}</p>
                                        </div>
                                    </div>

                                    {/* Items Preview */}
                                    {order.items && order.items.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <p className="text-sm text-slate-600">
                                                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
