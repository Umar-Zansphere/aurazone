'use client';

import { useEffect } from 'react';
import useCartStore from '@/store/cartStore';
import useWishlistStore from '@/store/wishlistStore';

export default function StoreInitializer() {
    const fetchCart = useCartStore((state) => state.fetchCart);
    const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);

    useEffect(() => {
        fetchCart();
        fetchWishlist();
    }, [fetchCart, fetchWishlist]);

    return null;
}
