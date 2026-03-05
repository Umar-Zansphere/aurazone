import { useSidebarStore } from "@/stores/use-sidebar-store";

describe("useSidebarStore", () => {
    beforeEach(() => {
        useSidebarStore.setState({ open: false, searchOpen: false });
    });

    test("initial state has open false", () => {
        expect(useSidebarStore.getState().open).toBe(false);
    });

    test("initial state has searchOpen false", () => {
        expect(useSidebarStore.getState().searchOpen).toBe(false);
    });

    test("toggle opens sidebar when closed", () => {
        useSidebarStore.getState().toggle();
        expect(useSidebarStore.getState().open).toBe(true);
    });

    test("toggle closes sidebar when open", () => {
        useSidebarStore.setState({ open: true });
        useSidebarStore.getState().toggle();
        expect(useSidebarStore.getState().open).toBe(false);
    });

    test("close sets open to false", () => {
        useSidebarStore.setState({ open: true });
        useSidebarStore.getState().close();
        expect(useSidebarStore.getState().open).toBe(false);
    });

    test("close when already closed stays false", () => {
        useSidebarStore.getState().close();
        expect(useSidebarStore.getState().open).toBe(false);
    });

    test("toggleSearch opens search when closed", () => {
        useSidebarStore.getState().toggleSearch();
        expect(useSidebarStore.getState().searchOpen).toBe(true);
    });

    test("toggleSearch closes search when open", () => {
        useSidebarStore.setState({ searchOpen: true });
        useSidebarStore.getState().toggleSearch();
        expect(useSidebarStore.getState().searchOpen).toBe(false);
    });

    test("closeSearch sets searchOpen to false", () => {
        useSidebarStore.setState({ searchOpen: true });
        useSidebarStore.getState().closeSearch();
        expect(useSidebarStore.getState().searchOpen).toBe(false);
    });

    test("sidebar and search are independent", () => {
        useSidebarStore.getState().toggle();
        useSidebarStore.getState().toggleSearch();

        const state = useSidebarStore.getState();
        expect(state.open).toBe(true);
        expect(state.searchOpen).toBe(true);
    });

    test("double toggle returns to original state", () => {
        useSidebarStore.getState().toggle();
        useSidebarStore.getState().toggle();
        expect(useSidebarStore.getState().open).toBe(false);
    });
});
