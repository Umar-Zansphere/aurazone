import { create } from 'zustand';
import { wishlistApi } from '@/lib/api';

const TEMP_WISHLIST_PREFIX = 'temp-wishlist-';
let wishlistSyncTimer = null;

const isTempWishlistId = (id) => typeof id === 'string' && id.startsWith(TEMP_WISHLIST_PREFIX);

const makeWishlistKey = (productId, variantId = null) => `${productId}::${variantId || 'any'}`;

const incrementPending = (pendingByKey = {}, key) => {
    if (!key) return pendingByKey;
    return {
        ...pendingByKey,
        [key]: (pendingByKey[key] || 0) + 1,
    };
};

const decrementPending = (pendingByKey = {}, key) => {
    if (!key || !pendingByKey[key]) return pendingByKey;
    const nextCount = pendingByKey[key] - 1;
    if (nextCount <= 0) {
        const { [key]: _ignored, ...rest } = pendingByKey;
        return rest;
    }
    return {
        ...pendingByKey,
        [key]: nextCount,
    };
};

const findWishlistItem = (items, productId, variantId = null) => {
    return items.find((item) =>
        item.productId === productId &&
        (variantId ? item.variantId === variantId : true)
    );
};

const buildOptimisticWishlistItem = (productId, variantId = null, itemSeed = {}) => {
    const now = Date.now();
    const variant = itemSeed?.variant || null;
    const product = itemSeed?.product || null;
    return {
        id: `${TEMP_WISHLIST_PREFIX}${productId}-${variantId || 'any'}-${now}`,
        productId,
        variantId: variantId || null,
        product: product?.id ? product : null,
        variant: variant?.id ? variant : null,
        _optimistic: true,
    };
};

const mergeServerWishlistItem = (items, serverItem) => {
    if (!serverItem?.productId) return items;

    const existingIndex = items.findIndex((item) => item.id === serverItem.id
        || (item.productId === serverItem.productId && item.variantId === serverItem.variantId));

    if (existingIndex >= 0) {
        const next = [...items];
        next[existingIndex] = serverItem;
        return next;
    }

    return [...items, serverItem];
};

const useWishlistStore = create((set, get) => ({
    // State
    items: [],
    isLoading: false,
    error: null,
    pendingByKey: {},

    // Actions
    setItems: (items) => set({
        items,
        error: null
    }),

    clearWishlist: () => set({
        items: [],
        error: null
    }),

    queueBackgroundSync: () => {
        if (wishlistSyncTimer) {
            clearTimeout(wishlistSyncTimer);
        }
        wishlistSyncTimer = setTimeout(() => {
            get().fetchWishlist({ silent: true }).catch(() => {});
        }, 220);
    },

    fetchWishlist: async (options = {}) => {
        const { silent = false } = options;
        if (!silent) {
            set({ isLoading: true, error: null });
        }

        try {
            const response = await wishlistApi.getWishlist();
            const wishlistItems = response.items || [];

            set((state) => ({
                items: Array.isArray(wishlistItems) ? wishlistItems : [],
                isLoading: silent ? state.isLoading : false,
                error: null
            }));

            return wishlistItems;
        } catch (error) {
            if (error.status === 401) {
                set((state) => ({
                    items: [],
                    isLoading: silent ? state.isLoading : false,
                    error: null
                }));
                return [];
            }

            console.error('Error fetching wishlist:', error);

            if (!silent) {
                set({
                    items: [],
                    isLoading: false,
                    error: error.message || 'Failed to fetch wishlist'
                });
            }

            return [];
        }
    },

    addToWishlist: async (productId, variantId = null, itemSeed = null) => {
        const snapshotItems = get().items;
        const existing = findWishlistItem(snapshotItems, productId, variantId);
        if (existing) {
            return { message: 'Item already in wishlist', wishlistItem: existing };
        }

        const key = makeWishlistKey(productId, variantId);
        set((state) => ({
            items: [...state.items, buildOptimisticWishlistItem(productId, variantId, itemSeed || {})],
            pendingByKey: incrementPending(state.pendingByKey, key),
            error: null,
        }));

        try {
            const response = await wishlistApi.addToWishlist(productId, variantId);
            const serverItem = response?.wishlistItem;

            if (serverItem) {
                set((state) => ({
                    items: mergeServerWishlistItem(state.items, serverItem),
                }));
            }

            get().queueBackgroundSync();

            return response;
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            set({ items: snapshotItems, error: error.message || 'Failed to update wishlist' });
            throw error;
        } finally {
            set((state) => ({
                pendingByKey: decrementPending(state.pendingByKey, key),
            }));
        }
    },

    removeItem: async (wishlistItemId) => {
        const snapshotItems = get().items;
        const targetItem = snapshotItems.find((item) => item.id === wishlistItemId);
        if (!targetItem) {
            return { message: 'Item already removed' };
        }

        const key = makeWishlistKey(targetItem.productId, targetItem.variantId || null);
        set((state) => ({
            items: state.items.filter((item) => item.id !== wishlistItemId),
            pendingByKey: incrementPending(state.pendingByKey, key),
            error: null,
        }));

        try {
            if (isTempWishlistId(wishlistItemId)) {
                get().queueBackgroundSync();
                return { message: 'Wishlist update queued' };
            }

            const response = await wishlistApi.removeFromWishlist(wishlistItemId);
            get().queueBackgroundSync();

            return response;
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            set({ items: snapshotItems, error: error.message || 'Failed to update wishlist' });
            throw error;
        } finally {
            set((state) => ({
                pendingByKey: decrementPending(state.pendingByKey, key),
            }));
        }
    },

    moveToCart: async (wishlistItemId) => {
        const snapshotItems = get().items;
        const targetItem = snapshotItems.find((item) => item.id === wishlistItemId);
        const key = targetItem ? makeWishlistKey(targetItem.productId, targetItem.variantId || null) : null;

        if (targetItem) {
            set((state) => ({
                items: state.items.filter((item) => item.id !== wishlistItemId),
                pendingByKey: incrementPending(state.pendingByKey, key),
                error: null,
            }));
        }

        try {
            const response = await wishlistApi.moveToCart(wishlistItemId);
            get().queueBackgroundSync();

            return response;
        } catch (error) {
            console.error('Error moving to cart:', error);
            if (targetItem) {
                set({ items: snapshotItems, error: error.message || 'Failed to move item to cart' });
            }
            throw error;
        } finally {
            if (key) {
                set((state) => ({
                    pendingByKey: decrementPending(state.pendingByKey, key),
                }));
            }
        }
    },

    removeByProductVariant: async (productId, variantId = null) => {
        const item = findWishlistItem(get().items, productId, variantId);
        if (!item) {
            return { message: 'Item already removed' };
        }
        return get().removeItem(item.id);
    },

    toggleWishlist: async (productId, variantId = null, itemSeed = null) => {
        if (get().isInWishlist(productId, variantId)) {
            return get().removeByProductVariant(productId, variantId);
        }
        return get().addToWishlist(productId, variantId, itemSeed);
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

    isWishlistPending: (productId, variantId = null) => {
        const pendingByKey = get().pendingByKey;
        return Boolean(pendingByKey[makeWishlistKey(productId, variantId)]);
    },
}));

export default useWishlistStore;
