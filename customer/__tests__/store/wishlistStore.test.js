/**
 * Tests for src/store/wishlistStore.js
 * Zustand store: useWishlistStore
 */
import { act } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
    wishlistApi: {
        getWishlist: jest.fn(),
        addToWishlist: jest.fn(),
        removeFromWishlist: jest.fn(),
        moveToCart: jest.fn(),
    },
}));

import useWishlistStore from '@/store/wishlistStore';
import { wishlistApi } from '@/lib/api';

beforeEach(() => {
    useWishlistStore.setState({
        items: [],
        isLoading: false,
        error: null,
    });
    jest.clearAllMocks();
});

// ─── Initial State ────────────────────────────────────────────────────────────

describe('wishlistStore initial state', () => {
    test('has empty items array', () => {
        expect(useWishlistStore.getState().items).toEqual([]);
    });

    test('isLoading is false', () => {
        expect(useWishlistStore.getState().isLoading).toBe(false);
    });

    test('error is null', () => {
        expect(useWishlistStore.getState().error).toBeNull();
    });
});

// ─── setItems ─────────────────────────────────────────────────────────────────

describe('setItems', () => {
    test('updates items and clears error', () => {
        const items = [{ id: '1', productId: 'p1' }];
        act(() => useWishlistStore.getState().setItems(items));
        expect(useWishlistStore.getState().items).toEqual(items);
        expect(useWishlistStore.getState().error).toBeNull();
    });
});

// ─── clearWishlist ────────────────────────────────────────────────────────────

describe('clearWishlist', () => {
    test('resets items and clears error', () => {
        useWishlistStore.setState({ items: [{ id: '1' }], error: 'err' });
        act(() => useWishlistStore.getState().clearWishlist());
        expect(useWishlistStore.getState().items).toEqual([]);
        expect(useWishlistStore.getState().error).toBeNull();
    });
});

// ─── fetchWishlist ────────────────────────────────────────────────────────────

describe('fetchWishlist', () => {
    test('fetches wishlist items successfully', async () => {
        const mockItems = [{ id: '1', productId: 'p1' }];
        wishlistApi.getWishlist.mockResolvedValueOnce({ items: mockItems });

        const result = await useWishlistStore.getState().fetchWishlist();

        expect(useWishlistStore.getState().items).toEqual(mockItems);
        expect(useWishlistStore.getState().isLoading).toBe(false);
        expect(result).toEqual(mockItems);
    });

    test('sets isLoading during fetch', async () => {
        let resolvePromise;
        wishlistApi.getWishlist.mockReturnValueOnce(new Promise(r => { resolvePromise = r; }));

        const promise = useWishlistStore.getState().fetchWishlist();
        expect(useWishlistStore.getState().isLoading).toBe(true);

        resolvePromise({ items: [] });
        await promise;
        expect(useWishlistStore.getState().isLoading).toBe(false);
    });

    test('handles 401 error silently', async () => {
        wishlistApi.getWishlist.mockRejectedValueOnce({ status: 401 });

        const result = await useWishlistStore.getState().fetchWishlist();

        expect(useWishlistStore.getState().items).toEqual([]);
        expect(useWishlistStore.getState().error).toBeNull();
        expect(result).toEqual([]);
    });

    test('sets error for non-401 errors', async () => {
        wishlistApi.getWishlist.mockRejectedValueOnce({ status: 500, message: 'Server error' });

        const result = await useWishlistStore.getState().fetchWishlist();

        expect(useWishlistStore.getState().error).toBe('Server error');
        expect(result).toEqual([]);
    });

    test('handles response without items property', async () => {
        wishlistApi.getWishlist.mockResolvedValueOnce({});

        await useWishlistStore.getState().fetchWishlist();
        expect(useWishlistStore.getState().items).toEqual([]);
    });

    test('wraps non-array items to empty', async () => {
        wishlistApi.getWishlist.mockResolvedValueOnce({ items: 'not-array' });

        await useWishlistStore.getState().fetchWishlist();
        expect(useWishlistStore.getState().items).toEqual([]);
    });
});

// ─── addToWishlist ────────────────────────────────────────────────────────────

describe('addToWishlist', () => {
    test('calls API and refreshes wishlist', async () => {
        wishlistApi.addToWishlist.mockResolvedValueOnce({});
        wishlistApi.getWishlist.mockResolvedValueOnce({ items: [{ id: '1' }] });

        await useWishlistStore.getState().addToWishlist('p1', 'v1');

        expect(wishlistApi.addToWishlist).toHaveBeenCalledWith('p1', 'v1');
        expect(wishlistApi.getWishlist).toHaveBeenCalled();
    });

    test('works without variantId', async () => {
        wishlistApi.addToWishlist.mockResolvedValueOnce({});
        wishlistApi.getWishlist.mockResolvedValueOnce({ items: [] });

        await useWishlistStore.getState().addToWishlist('p1');

        expect(wishlistApi.addToWishlist).toHaveBeenCalledWith('p1', null);
    });

    test('re-throws error on failure', async () => {
        wishlistApi.addToWishlist.mockRejectedValueOnce(new Error('Failed'));

        await expect(useWishlistStore.getState().addToWishlist('p1')).rejects.toThrow('Failed');
    });
});

// ─── removeItem ───────────────────────────────────────────────────────────────

describe('removeItem', () => {
    test('calls API and refreshes wishlist', async () => {
        wishlistApi.removeFromWishlist.mockResolvedValueOnce({});
        wishlistApi.getWishlist.mockResolvedValueOnce({ items: [] });

        await useWishlistStore.getState().removeItem('w1');

        expect(wishlistApi.removeFromWishlist).toHaveBeenCalledWith('w1');
        expect(wishlistApi.getWishlist).toHaveBeenCalled();
    });

    test('re-throws error on failure', async () => {
        wishlistApi.removeFromWishlist.mockRejectedValueOnce(new Error('Failed'));

        await expect(useWishlistStore.getState().removeItem('w1')).rejects.toThrow('Failed');
    });
});

// ─── moveToCart ────────────────────────────────────────────────────────────────

describe('moveToCart', () => {
    test('calls API and refreshes wishlist', async () => {
        wishlistApi.moveToCart.mockResolvedValueOnce({});
        wishlistApi.getWishlist.mockResolvedValueOnce({ items: [] });

        await useWishlistStore.getState().moveToCart('w1');

        expect(wishlistApi.moveToCart).toHaveBeenCalledWith('w1');
        expect(wishlistApi.getWishlist).toHaveBeenCalled();
    });

    test('re-throws error on failure', async () => {
        wishlistApi.moveToCart.mockRejectedValueOnce(new Error('Failed'));

        await expect(useWishlistStore.getState().moveToCart('w1')).rejects.toThrow('Failed');
    });
});

// ─── getWishlistCount ─────────────────────────────────────────────────────────

describe('getWishlistCount', () => {
    test('returns number of items', () => {
        useWishlistStore.setState({ items: [{ id: '1' }, { id: '2' }, { id: '3' }] });
        expect(useWishlistStore.getState().getWishlistCount()).toBe(3);
    });

    test('returns 0 for empty wishlist', () => {
        expect(useWishlistStore.getState().getWishlistCount()).toBe(0);
    });
});

// ─── isInWishlist ─────────────────────────────────────────────────────────────

describe('isInWishlist', () => {
    test('returns true when product is in wishlist', () => {
        useWishlistStore.setState({ items: [{ id: '1', productId: 'p1', variantId: 'v1' }] });
        expect(useWishlistStore.getState().isInWishlist('p1')).toBe(true);
    });

    test('returns true when product+variant match', () => {
        useWishlistStore.setState({ items: [{ id: '1', productId: 'p1', variantId: 'v1' }] });
        expect(useWishlistStore.getState().isInWishlist('p1', 'v1')).toBe(true);
    });

    test('returns false when variant does not match', () => {
        useWishlistStore.setState({ items: [{ id: '1', productId: 'p1', variantId: 'v1' }] });
        expect(useWishlistStore.getState().isInWishlist('p1', 'v2')).toBe(false);
    });

    test('returns false when product not in wishlist', () => {
        useWishlistStore.setState({ items: [{ id: '1', productId: 'p1' }] });
        expect(useWishlistStore.getState().isInWishlist('p2')).toBe(false);
    });

    test('returns false for empty wishlist', () => {
        expect(useWishlistStore.getState().isInWishlist('p1')).toBe(false);
    });
});
