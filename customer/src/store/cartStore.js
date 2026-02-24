import { create } from 'zustand';
import { cartApi } from '@/lib/api';

const useCartStore = create((set, get) => ({
    // State
    items: [],
    isLoading: false,
    error: null,

    // Actions
    setItems: (items) => set({
        items,
        error: null
    }),

    clearCart: () => set({
        items: [],
        error: null
    }),

    fetchCart: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await cartApi.getCart();
            // API returns cart object with items array
            const cartItems = response.items || [];

            set({
                items: Array.isArray(cartItems) ? cartItems : [],
                isLoading: false,
                error: null
            });

            return cartItems;
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
            console.error('Error fetching cart:', error);
            set({
                items: [],
                isLoading: false,
                error: error.message || 'Failed to fetch cart'
            });
            return [];
        }
    },

    addToCart: async (variantId, quantity = 1) => {
        try {
            const response = await cartApi.addToCart(variantId, quantity);

            // Refresh cart after adding
            await get().fetchCart();

            return response;
        } catch (error) {
            console.error('Error adding to cart:', error);
            throw error;
        }
    },

    updateQuantity: async (cartItemId, quantity) => {
        try {
            const response = await cartApi.updateCartItem(cartItemId, quantity);

            // Refresh cart after updating
            await get().fetchCart();

            return response;
        } catch (error) {
            console.error('Error updating cart:', error);
            throw error;
        }
    },

    removeItem: async (cartItemId) => {
        try {
            const response = await cartApi.removeFromCart(cartItemId);

            // Refresh cart after removing
            await get().fetchCart();

            return response;
        } catch (error) {
            console.error('Error removing from cart:', error);
            throw error;
        }
    },

    // Get cart count
    getCartCount: () => {
        const items = get().items;
        return items.reduce((total, item) => total + (item.quantity || 0), 0);
    },

    // Check if item is in cart
    isInCart: (variantId) => {
        const items = get().items;
        return items.some(item => item.variantId === variantId);
    },

    // Get cart total
    getCartTotal: () => {
        const items = get().items;
        return items.reduce((total, item) => {
            const price = parseFloat(item.variant?.price || item.price || 0);
            const quantity = item.quantity || 0;
            return total + (price * quantity);
        }, 0);
    },
}));

export default useCartStore;
