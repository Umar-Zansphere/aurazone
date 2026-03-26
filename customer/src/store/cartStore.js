import { create } from 'zustand';
import { cartApi } from '@/lib/api';

const TEMP_CART_PREFIX = 'temp-cart-';
let cartSyncTimer = null;

const isTempCartId = (id) => typeof id === 'string' && id.startsWith(TEMP_CART_PREFIX);

const buildOptimisticCartItem = (variantId, quantity, itemSeed = {}) => {
    const now = Date.now();
    const variant = itemSeed?.variant || {};
    const product = itemSeed?.product || {};
    const unitPrice = Number(variant?.price ?? itemSeed?.unitPrice ?? 0);

    return {
        id: `${TEMP_CART_PREFIX}${variantId}-${now}`,
        variantId,
        productId: product?.id || variant?.productId || itemSeed?.productId || null,
        quantity,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        product: product?.id ? product : null,
        variant: variant?.id
            ? variant
            : {
                id: variantId,
                price: Number.isFinite(unitPrice) ? unitPrice : 0,
                isAvailable: true,
                images: [],
            },
        _optimistic: true,
    };
};

const incrementPending = (pendingByVariant = {}, variantId) => {
    if (!variantId) return pendingByVariant;
    return {
        ...pendingByVariant,
        [variantId]: (pendingByVariant[variantId] || 0) + 1,
    };
};

const decrementPending = (pendingByVariant = {}, variantId) => {
    if (!variantId || !pendingByVariant[variantId]) return pendingByVariant;

    const nextCount = pendingByVariant[variantId] - 1;
    if (nextCount <= 0) {
        const { [variantId]: _ignored, ...rest } = pendingByVariant;
        return rest;
    }

    return {
        ...pendingByVariant,
        [variantId]: nextCount,
    };
};

const mergeServerCartItem = (items, serverItem) => {
    if (!serverItem?.variantId) return items;

    const existingIndex = items.findIndex(
        (item) => item.id === serverItem.id || item.variantId === serverItem.variantId
    );

    if (existingIndex >= 0) {
        const next = [...items];
        next[existingIndex] = serverItem;
        return next;
    }

    return [...items, serverItem];
};

const useCartStore = create((set, get) => ({
    // State
    items: [],
    isLoading: false,
    error: null,
    pendingByVariant: {},

    // Actions
    setItems: (items) => set({
        items,
        error: null
    }),

    clearCart: () => set({
        items: [],
        error: null
    }),

    queueBackgroundSync: () => {
        if (cartSyncTimer) {
            clearTimeout(cartSyncTimer);
        }
        cartSyncTimer = setTimeout(() => {
            get().fetchCart({ silent: true }).catch(() => {});
        }, 220);
    },

    fetchCart: async (options = {}) => {
        const { silent = false } = options;
        if (!silent) {
            set({ isLoading: true, error: null });
        }

        try {
            const response = await cartApi.getCart();
            const cartItems = response.items || [];

            set((state) => ({
                items: Array.isArray(cartItems) ? cartItems : [],
                isLoading: silent ? state.isLoading : false,
                error: null
            }));

            return cartItems;
        } catch (error) {
            if (error.status === 401) {
                set((state) => ({
                    items: [],
                    isLoading: silent ? state.isLoading : false,
                    error: null
                }));
                return [];
            }

            console.error('Error fetching cart:', error);

            if (!silent) {
                set({
                    items: [],
                    isLoading: false,
                    error: error.message || 'Failed to fetch cart'
                });
            }

            return [];
        }
    },

    addToCart: async (variantId, quantity = 1, itemSeed = null) => {
        const snapshotItems = get().items;
        const existingItem = snapshotItems.find((item) => item.variantId === variantId);

        set((state) => {
            const nextItems = existingItem
                ? state.items.map((item) =>
                    item.variantId === variantId
                        ? { ...item, quantity: Number(item.quantity || 0) + quantity, _optimistic: true }
                        : item
                )
                : [...state.items, buildOptimisticCartItem(variantId, quantity, itemSeed || {})];

            return {
                items: nextItems,
                error: null,
                pendingByVariant: incrementPending(state.pendingByVariant, variantId),
            };
        });

        try {
            const response = await cartApi.addToCart(variantId, quantity);
            const serverItem = response?.cartItem;

            if (serverItem) {
                set((state) => ({
                    items: mergeServerCartItem(state.items, serverItem),
                }));
            }

            get().queueBackgroundSync();

            return response;
        } catch (error) {
            console.error('Error adding to cart:', error);
            set({ items: snapshotItems, error: error.message || 'Failed to add to cart' });
            throw error;
        } finally {
            set((state) => ({
                pendingByVariant: decrementPending(state.pendingByVariant, variantId),
            }));
        }
    },

    updateQuantity: async (cartItemId, quantity) => {
        const snapshotItems = get().items;
        const targetItem = snapshotItems.find((item) => item.id === cartItemId);
        if (!targetItem) {
            throw new Error('Cart item not found');
        }

        const variantId = targetItem.variantId;
        set((state) => ({
            items: state.items.map((item) =>
                item.id === cartItemId
                    ? { ...item, quantity, _optimistic: true }
                    : item
            ),
            pendingByVariant: incrementPending(state.pendingByVariant, variantId),
            error: null,
        }));

        try {
            if (isTempCartId(cartItemId)) {
                get().queueBackgroundSync();
                return { message: 'Cart update queued' };
            }

            const response = await cartApi.updateCartItem(cartItemId, quantity);
            const serverItem = response?.cartItem;

            if (serverItem) {
                set((state) => ({
                    items: mergeServerCartItem(state.items, serverItem),
                }));
            }

            get().queueBackgroundSync();

            return response;
        } catch (error) {
            console.error('Error updating cart:', error);
            set({ items: snapshotItems, error: error.message || 'Failed to update cart' });
            throw error;
        } finally {
            set((state) => ({
                pendingByVariant: decrementPending(state.pendingByVariant, variantId),
            }));
        }
    },

    removeItem: async (cartItemId) => {
        const snapshotItems = get().items;
        const targetItem = snapshotItems.find((item) => item.id === cartItemId);
        if (!targetItem) {
            return { message: 'Item already removed' };
        }

        const variantId = targetItem.variantId;
        set((state) => ({
            items: state.items.filter((item) => item.id !== cartItemId),
            pendingByVariant: incrementPending(state.pendingByVariant, variantId),
            error: null,
        }));

        try {
            if (isTempCartId(cartItemId)) {
                get().queueBackgroundSync();
                return { message: 'Cart update queued' };
            }

            const response = await cartApi.removeFromCart(cartItemId);
            get().queueBackgroundSync();

            return response;
        } catch (error) {
            console.error('Error removing from cart:', error);
            set({ items: snapshotItems, error: error.message || 'Failed to remove from cart' });
            throw error;
        } finally {
            set((state) => ({
                pendingByVariant: decrementPending(state.pendingByVariant, variantId),
            }));
        }
    },

    removeByVariantId: async (variantId) => {
        const item = get().items.find((entry) => entry.variantId === variantId);
        if (!item) {
            return { message: 'Item already removed' };
        }
        return get().removeItem(item.id);
    },

    toggleVariantInCart: async (variantId, quantity = 1, itemSeed = null) => {
        if (get().isInCart(variantId)) {
            return get().removeByVariantId(variantId);
        }
        return get().addToCart(variantId, quantity, itemSeed);
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

    isVariantPending: (variantId) => {
        const pendingByVariant = get().pendingByVariant;
        return Boolean(pendingByVariant[variantId]);
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
