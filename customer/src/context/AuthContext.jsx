'use client';

import { createContext, useContext, useEffect } from 'react';
import useUserStore from '@/store/userStore';
import { authApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const router = useRouter();
    const { user, isLoading, isAuthenticated, error, fetchUser, clearUser } = useUserStore();

    // Auto-fetch user on mount
    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = async () => {
        // After login API call, fetch user data
        await fetchUser();
    };

    const logout = async () => {
        try {
            // Call logout API to clear cookies
            await authApi.logout();

            // Clear user state
            clearUser();

            // Redirect to home
            router.push('/');
        } catch (error) {
            console.error('Logout error:', error);
            // Clear user state even if API fails
            clearUser();
            router.push('/');
        }
    };

    const refreshUser = async () => {
        await fetchUser();
    };

    const value = {
        user,
        isLoading,
        isAuthenticated,
        error,
        login,
        logout,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
