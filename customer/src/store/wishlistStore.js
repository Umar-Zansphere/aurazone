import { create } from 'zustand';
import { wishlistApi } from '@/lib/api';

const useWishlistStore = create((set, get) => ({
    // State
    items: [],
    isLoading: false,
    error: null,

    // Actions
    setItems: (items) => set({
        items,
        error: null
    }),

    clearWishlist: () => set({
        items: [],
        error: null
    }),

    fetchWishlist: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await wishlistApi.getWishlist();
            // API returns wishlist object with items array (similar to cart)
            const wishlistItems = response.items || [];

            set({
                items: Array.isArray(wishlistItems) ? wishlistItems : [],
                isLoading: false,
                error: null
            });

            return wishlistItems;
        } catch (error) {
            // Handle 401 (unauthenticated) - guest users also use API with guestSessionId
            if (error.status === 401) {
                set({
                    items: [],
                    isLoading: false,
                    error: null // Don't show error for unauthenticated users
                });
                return [];
            }

            // For other errors, set error state
            console.error('Error fetching wishlist:', error);
            set({
                items: [],
                isLoading: false,
                error: error.message || 'Failed to fetch wishlist'
            });
            return [];
        }
    },

    addToWishlist: async (productId, variantId = null) => {
        try {
            const response = await wishlistApi.addToWishlist(productId, variantId);

            // Refresh wishlist after adding
            await get().fetchWishlist();

            return response;
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            throw error;
        }
    },

    removeItem: async (wishlistItemId) => {
        try {
            const response = await wishlistApi.removeFromWishlist(wishlistItemId);

            // Refresh wishlist after removing
            await get().fetchWishlist();

            return response;
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            throw error;
        }
    },

    moveToCart: async (wishlistItemId) => {
        try {
            const response = await wishlistApi.moveToCart(wishlistItemId);

            // Refresh wishlist after moving
            await get().fetchWishlist();

            return response;
        } catch (error) {
            console.error('Error moving to cart:', error);
            throw error;
        }
    },

    // Get wishlist count
    getWishlistCount: () => {
        return get().items.length;
    },

    // Check if item is in wishlist
    isInWishlist: (productId, variantId = null) => {
        const items = get().items;
        return items.some(item =>
            item.productId === productId &&
            (variantId ? item.variantId === variantId : true)
        );
    },
}));

export default useWishlistStore;
