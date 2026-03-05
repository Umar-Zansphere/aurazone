/**
 * Tests for src/store/userStore.js
 * Zustand store: useUserStore
 */
import { act } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
    userApi: {
        getProfile: jest.fn(),
    },
}));

import useUserStore from '@/store/userStore';
import { userApi } from '@/lib/api';

beforeEach(() => {
    useUserStore.setState({
        user: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,
    });
    jest.clearAllMocks();
});

// ─── Initial State ────────────────────────────────────────────────────────────

describe('userStore initial state', () => {
    test('user is null', () => {
        expect(useUserStore.getState().user).toBeNull();
    });

    test('isLoading is false', () => {
        expect(useUserStore.getState().isLoading).toBe(false);
    });

    test('error is null', () => {
        expect(useUserStore.getState().error).toBeNull();
    });

    test('isAuthenticated is false', () => {
        expect(useUserStore.getState().isAuthenticated).toBe(false);
    });
});

// ─── setUser ──────────────────────────────────────────────────────────────────

describe('setUser', () => {
    test('sets user and marks authenticated', () => {
        const user = { id: '1', email: 'test@test.com' };
        act(() => useUserStore.getState().setUser(user));
        expect(useUserStore.getState().user).toEqual(user);
        expect(useUserStore.getState().isAuthenticated).toBe(true);
        expect(useUserStore.getState().error).toBeNull();
    });

    test('sets user to null and marks unauthenticated', () => {
        useUserStore.setState({ user: { id: '1' }, isAuthenticated: true });
        act(() => useUserStore.getState().setUser(null));
        expect(useUserStore.getState().user).toBeNull();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
    });
});

// ─── clearUser ────────────────────────────────────────────────────────────────

describe('clearUser', () => {
    test('clears user, auth, and error', () => {
        useUserStore.setState({
            user: { id: '1' },
            isAuthenticated: true,
            error: 'some error',
        });
        act(() => useUserStore.getState().clearUser());
        expect(useUserStore.getState().user).toBeNull();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
        expect(useUserStore.getState().error).toBeNull();
    });
});

// ─── fetchUser ────────────────────────────────────────────────────────────────

describe('fetchUser', () => {
    test('fetches user with success response (response.success)', async () => {
        const userData = { id: '1', email: 'test@test.com' };
        userApi.getProfile.mockResolvedValueOnce({ success: true, data: userData });

        const result = await useUserStore.getState().fetchUser();

        expect(useUserStore.getState().user).toEqual(userData);
        expect(useUserStore.getState().isAuthenticated).toBe(true);
        expect(useUserStore.getState().isLoading).toBe(false);
        expect(result).toEqual(userData);
    });

    test('fetches user with response.id format', async () => {
        const userData = { id: '1', email: 'test@test.com' };
        userApi.getProfile.mockResolvedValueOnce(userData);

        const result = await useUserStore.getState().fetchUser();

        expect(useUserStore.getState().user).toEqual(userData);
        expect(useUserStore.getState().isAuthenticated).toBe(true);
        expect(result).toEqual(userData);
    });

    test('sets isLoading during fetch', async () => {
        let resolvePromise;
        userApi.getProfile.mockReturnValueOnce(new Promise(r => { resolvePromise = r; }));

        const promise = useUserStore.getState().fetchUser();
        expect(useUserStore.getState().isLoading).toBe(true);

        resolvePromise({ id: '1' });
        await promise;
        expect(useUserStore.getState().isLoading).toBe(false);
    });

    test('handles unsuccessful response (no success/id)', async () => {
        userApi.getProfile.mockResolvedValueOnce({ message: 'not found' });

        const result = await useUserStore.getState().fetchUser();

        expect(useUserStore.getState().user).toBeNull();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
        expect(useUserStore.getState().error).toBe('Failed to fetch user');
        expect(result).toBeNull();
    });

    test('handles 401 error silently', async () => {
        userApi.getProfile.mockRejectedValueOnce({ status: 401 });

        const result = await useUserStore.getState().fetchUser();

        expect(useUserStore.getState().user).toBeNull();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
        expect(useUserStore.getState().error).toBeNull();
        expect(result).toBeNull();
    });

    test('handles non-401 error', async () => {
        userApi.getProfile.mockRejectedValueOnce({ status: 500, message: 'Server error' });

        const result = await useUserStore.getState().fetchUser();

        expect(useUserStore.getState().user).toBeNull();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
        expect(useUserStore.getState().error).toBe('Server error');
        expect(result).toBeNull();
    });

    test('handles error without message', async () => {
        userApi.getProfile.mockRejectedValueOnce({ status: 500 });

        const result = await useUserStore.getState().fetchUser();

        expect(useUserStore.getState().error).toBe('Failed to fetch user');
        expect(result).toBeNull();
    });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser', () => {
    test('merges updates into existing user', () => {
        useUserStore.setState({ user: { id: '1', email: 'old@test.com', name: 'Old' } });
        act(() => useUserStore.getState().updateUser({ email: 'new@test.com' }));
        expect(useUserStore.getState().user).toEqual({
            id: '1',
            email: 'new@test.com',
            name: 'Old',
        });
    });

    test('does nothing when user is null', () => {
        act(() => useUserStore.getState().updateUser({ email: 'new@test.com' }));
        expect(useUserStore.getState().user).toBeNull();
    });

    test('can update multiple fields', () => {
        useUserStore.setState({ user: { id: '1', email: 'old@test.com', name: 'Old' } });
        act(() => useUserStore.getState().updateUser({ email: 'new@test.com', name: 'New' }));
        expect(useUserStore.getState().user.email).toBe('new@test.com');
        expect(useUserStore.getState().user.name).toBe('New');
    });
});
