import { create } from 'zustand';
import { userApi } from '@/lib/api';

const useUserStore = create((set, get) => ({
    // State
    user: null,
    isLoading: false,
    error: null,
    isAuthenticated: false,

    // Actions
    setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        error: null
    }),

    clearUser: () => set({
        user: null,
        isAuthenticated: false,
        error: null
    }),

    fetchUser: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await userApi.getProfile();

            if (response && (response.success || response.id)) {
                const userData = response.success ? response.data : response;
                set({
                    user: userData,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null
                });
                return userData;
            } else {
                set({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: 'Failed to fetch user'
                });
                return null;
            }
        } catch (error) {
            // Check if it's a 401 error (unauthenticated) - treat as guest
            if (error.status === 401) {
                set({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null // Don't show error for unauthenticated users
                });
                return null;
            }

            // For other errors, set error state
            console.error('Error fetching user:', error);
            set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: error.message || 'Failed to fetch user'
            });
            return null;
        }
    },

    updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
            set({ user: { ...currentUser, ...updates } });
        }
    },
}));

export default useUserStore;
