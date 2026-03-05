/**
 * Tests for src/store/cartStore.js
 * Zustand store: useCartStore
 */
import { act } from '@testing-library/react';

// Mock the cart API
jest.mock('@/lib/api', () => ({
    cartApi: {
        getCart: jest.fn(),
        addToCart: jest.fn(),
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
    },
}));

import useCartStore from '@/store/cartStore';
import { cartApi } from '@/lib/api';

// Reset store between tests
beforeEach(() => {
    useCartStore.setState({
        items: [],
        isLoading: false,
        error: null,
    });
    jest.clearAllMocks();
});

// ─── Initial State ────────────────────────────────────────────────────────────

describe('cartStore initial state', () => {
    test('has empty items array', () => {
        expect(useCartStore.getState().items).toEqual([]);
    });

    test('isLoading is false', () => {
        expect(useCartStore.getState().isLoading).toBe(false);
    });

    test('error is null', () => {
        expect(useCartStore.getState().error).toBeNull();
    });
});

// ─── setItems ─────────────────────────────────────────────────────────────────

describe('setItems', () => {
    test('updates items and clears error', () => {
        const items = [{ id: '1', variantId: 'v1', quantity: 2 }];
        act(() => useCartStore.getState().setItems(items));
        expect(useCartStore.getState().items).toEqual(items);
        expect(useCartStore.getState().error).toBeNull();
    });
});

// ─── clearCart ─────────────────────────────────────────────────────────────────

describe('clearCart', () => {
    test('resets items to empty and clears error', () => {
        useCartStore.setState({ items: [{ id: '1' }], error: 'some error' });
        act(() => useCartStore.getState().clearCart());
        expect(useCartStore.getState().items).toEqual([]);
        expect(useCartStore.getState().error).toBeNull();
    });
});

// ─── fetchCart ─────────────────────────────────────────────────────────────────

describe('fetchCart', () => {
    test('fetches cart items successfully', async () => {
        const mockItems = [{ id: '1', variantId: 'v1', quantity: 1 }];
        cartApi.getCart.mockResolvedValueOnce({ items: mockItems });

        const result = await useCartStore.getState().fetchCart();

        expect(useCartStore.getState().items).toEqual(mockItems);
        expect(useCartStore.getState().isLoading).toBe(false);
        expect(useCartStore.getState().error).toBeNull();
        expect(result).toEqual(mockItems);
    });

    test('sets isLoading to true during fetch', async () => {
        let resolvePromise;
        cartApi.getCart.mockReturnValueOnce(new Promise(r => { resolvePromise = r; }));

        const fetchPromise = useCartStore.getState().fetchCart();
        expect(useCartStore.getState().isLoading).toBe(true);

        resolvePromise({ items: [] });
        await fetchPromise;
        expect(useCartStore.getState().isLoading).toBe(false);
    });

    test('handles 401 error silently (guest user)', async () => {
        cartApi.getCart.mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });

        const result = await useCartStore.getState().fetchCart();

        expect(useCartStore.getState().items).toEqual([]);
        expect(useCartStore.getState().error).toBeNull();
        expect(result).toEqual([]);
    });

    test('sets error for non-401 errors', async () => {
        cartApi.getCart.mockRejectedValueOnce({ status: 500, message: 'Server error' });

        const result = await useCartStore.getState().fetchCart();

        expect(useCartStore.getState().items).toEqual([]);
        expect(useCartStore.getState().error).toBe('Server error');
        expect(result).toEqual([]);
    });

    test('handles response without items property', async () => {
        cartApi.getCart.mockResolvedValueOnce({});

        await useCartStore.getState().fetchCart();

        expect(useCartStore.getState().items).toEqual([]);
    });

    test('wraps non-array items to empty array', async () => {
        cartApi.getCart.mockResolvedValueOnce({ items: 'not-array' });

        await useCartStore.getState().fetchCart();

        expect(useCartStore.getState().items).toEqual([]);
    });
});

// ─── addToCart ─────────────────────────────────────────────────────────────────

describe('addToCart', () => {
    test('calls API and refreshes cart', async () => {
        cartApi.addToCart.mockResolvedValueOnce({ success: true });
        cartApi.getCart.mockResolvedValueOnce({ items: [{ id: '1', variantId: 'v1', quantity: 1 }] });

        await useCartStore.getState().addToCart('v1', 1);

        expect(cartApi.addToCart).toHaveBeenCalledWith('v1', 1);
        expect(cartApi.getCart).toHaveBeenCalled();
    });

    test('uses default quantity of 1', async () => {
        cartApi.addToCart.mockResolvedValueOnce({ success: true });
        cartApi.getCart.mockResolvedValueOnce({ items: [] });

        await useCartStore.getState().addToCart('v1');

        expect(cartApi.addToCart).toHaveBeenCalledWith('v1', 1);
    });

    test('re-throws error on failure', async () => {
        cartApi.addToCart.mockRejectedValueOnce(new Error('Failed'));

        await expect(useCartStore.getState().addToCart('v1', 1)).rejects.toThrow('Failed');
    });
});

// ─── updateQuantity ───────────────────────────────────────────────────────────

describe('updateQuantity', () => {
    test('calls API and refreshes cart', async () => {
        cartApi.updateCartItem.mockResolvedValueOnce({});
        cartApi.getCart.mockResolvedValueOnce({ items: [] });

        await useCartStore.getState().updateQuantity('item-1', 5);

        expect(cartApi.updateCartItem).toHaveBeenCalledWith('item-1', 5);
        expect(cartApi.getCart).toHaveBeenCalled();
    });

    test('re-throws error on failure', async () => {
        cartApi.updateCartItem.mockRejectedValueOnce(new Error('Failed'));

        await expect(useCartStore.getState().updateQuantity('item-1', 5)).rejects.toThrow('Failed');
    });
});

// ─── removeItem ───────────────────────────────────────────────────────────────

describe('removeItem', () => {
    test('calls API and refreshes cart', async () => {
        cartApi.removeFromCart.mockResolvedValueOnce({});
        cartApi.getCart.mockResolvedValueOnce({ items: [] });

        await useCartStore.getState().removeItem('item-1');

        expect(cartApi.removeFromCart).toHaveBeenCalledWith('item-1');
        expect(cartApi.getCart).toHaveBeenCalled();
    });

    test('re-throws error on failure', async () => {
        cartApi.removeFromCart.mockRejectedValueOnce(new Error('Failed'));

        await expect(useCartStore.getState().removeItem('item-1')).rejects.toThrow('Failed');
    });
});

// ─── getCartCount ─────────────────────────────────────────────────────────────

describe('getCartCount', () => {
    test('returns sum of quantities', () => {
        useCartStore.setState({
            items: [
                { id: '1', quantity: 2 },
                { id: '2', quantity: 3 },
            ],
        });
        expect(useCartStore.getState().getCartCount()).toBe(5);
    });

    test('returns 0 for empty cart', () => {
        expect(useCartStore.getState().getCartCount()).toBe(0);
    });

    test('handles items without quantity', () => {
        useCartStore.setState({ items: [{ id: '1' }] });
        expect(useCartStore.getState().getCartCount()).toBe(0);
    });
});

// ─── isInCart ─────────────────────────────────────────────────────────────────

describe('isInCart', () => {
    test('returns true when variant is in cart', () => {
        useCartStore.setState({ items: [{ id: '1', variantId: 'v1' }] });
        expect(useCartStore.getState().isInCart('v1')).toBe(true);
    });

    test('returns false when variant is not in cart', () => {
        useCartStore.setState({ items: [{ id: '1', variantId: 'v1' }] });
        expect(useCartStore.getState().isInCart('v2')).toBe(false);
    });

    test('returns false for empty cart', () => {
        expect(useCartStore.getState().isInCart('v1')).toBe(false);
    });
});

// ─── getCartTotal ─────────────────────────────────────────────────────────────

describe('getCartTotal', () => {
    test('calculates total from variant prices', () => {
        useCartStore.setState({
            items: [
                { id: '1', variant: { price: '100.00' }, quantity: 2 },
                { id: '2', variant: { price: '50.00' }, quantity: 1 },
            ],
        });
        expect(useCartStore.getState().getCartTotal()).toBe(250);
    });

    test('falls back to item price when variant price missing', () => {
        useCartStore.setState({
            items: [{ id: '1', price: '100.00', quantity: 3 }],
        });
        expect(useCartStore.getState().getCartTotal()).toBe(300);
    });

    test('returns 0 for empty cart', () => {
        expect(useCartStore.getState().getCartTotal()).toBe(0);
    });

    test('handles items without quantity', () => {
        useCartStore.setState({
            items: [{ id: '1', variant: { price: '100.00' } }],
        });
        expect(useCartStore.getState().getCartTotal()).toBe(0);
    });

    test('handles items without price', () => {
        useCartStore.setState({
            items: [{ id: '1', quantity: 2 }],
        });
        expect(useCartStore.getState().getCartTotal()).toBe(0);
    });
});
