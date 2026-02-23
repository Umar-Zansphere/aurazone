import { create } from "zustand";

export const useSidebarStore = create((set) => ({
    open: false,
    searchOpen: false,
    toggle: () => set((state) => ({ open: !state.open })),
    close: () => set({ open: false }),
    toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
    closeSearch: () => set({ searchOpen: false }),
}));
