jest.mock("@/lib/api", () => ({
    apiFetch: jest.fn(),
}));

jest.mock("@/lib/sample-data", () => ({
    fallbackDashboard: {
        todayRevenue: 100,
        todayOrders: 1,
        pendingOrders: 0,
        statusBreakdown: {},
        lowStockCount: 0,
        revenueTimeseries: [],
        topProduct: null,
        activityFeed: [],
    },
}));

import { useDashboardStore } from "@/stores/use-dashboard-store";
import { apiFetch } from "@/lib/api";
import { fallbackDashboard } from "@/lib/sample-data";

describe("useDashboardStore", () => {
    beforeEach(() => {
        useDashboardStore.setState({
            data: null,
            loading: false,
            refreshing: false,
            error: null,
        });
        apiFetch.mockReset();
    });

    test("initial state has null data", () => {
        expect(useDashboardStore.getState().data).toBeNull();
    });

    test("initial state has loading false", () => {
        expect(useDashboardStore.getState().loading).toBe(false);
    });

    test("initial state has refreshing false", () => {
        expect(useDashboardStore.getState().refreshing).toBe(false);
    });

    test("initial state has null error", () => {
        expect(useDashboardStore.getState().error).toBeNull();
    });

    test("fetchDashboard success sets data", async () => {
        const mockData = { todayRevenue: 5000, todayOrders: 3 };
        apiFetch.mockResolvedValueOnce(mockData);

        await useDashboardStore.getState().fetchDashboard();

        expect(useDashboardStore.getState().data).toEqual(mockData);
        expect(useDashboardStore.getState().loading).toBe(false);
    });

    test("fetchDashboard sets loading true when no existing data", async () => {
        let resolve;
        apiFetch.mockReturnValue(new Promise((r) => { resolve = r; }));

        const promise = useDashboardStore.getState().fetchDashboard();
        expect(useDashboardStore.getState().loading).toBe(true);

        resolve({ todayRevenue: 0 });
        await promise;
    });

    test("fetchDashboard with refresh sets refreshing instead of loading", async () => {
        useDashboardStore.setState({ data: { todayRevenue: 100 } });

        let resolve;
        apiFetch.mockReturnValue(new Promise((r) => { resolve = r; }));

        const promise = useDashboardStore.getState().fetchDashboard({ refresh: true });
        expect(useDashboardStore.getState().refreshing).toBe(true);
        expect(useDashboardStore.getState().loading).toBe(false);

        resolve({ todayRevenue: 200 });
        await promise;
    });

    test("fetchDashboard error falls back to existing data", async () => {
        const existing = { todayRevenue: 500 };
        useDashboardStore.setState({ data: existing });
        apiFetch.mockRejectedValueOnce(new Error("Network error"));

        await useDashboardStore.getState().fetchDashboard();

        expect(useDashboardStore.getState().data).toEqual(existing);
        expect(useDashboardStore.getState().error).toBe("Network error");
    });

    test("fetchDashboard error without existing data falls back to fallbackDashboard", async () => {
        apiFetch.mockRejectedValueOnce(new Error("Server down"));

        await useDashboardStore.getState().fetchDashboard();

        expect(useDashboardStore.getState().data).toEqual(fallbackDashboard);
    });

    test("fetchDashboard calls correct API endpoint", async () => {
        apiFetch.mockResolvedValueOnce({});
        await useDashboardStore.getState().fetchDashboard();

        expect(apiFetch).toHaveBeenCalledWith("/admin/dashboard");
    });

    test("fetchDashboard clears error on retry", async () => {
        useDashboardStore.setState({ error: "old error" });
        apiFetch.mockResolvedValueOnce({ todayRevenue: 0 });

        await useDashboardStore.getState().fetchDashboard();
        expect(useDashboardStore.getState().error).toBeNull();
    });

    test("fetchDashboard sets loading and refreshing to false after success", async () => {
        apiFetch.mockResolvedValueOnce({});
        await useDashboardStore.getState().fetchDashboard();

        const state = useDashboardStore.getState();
        expect(state.loading).toBe(false);
        expect(state.refreshing).toBe(false);
    });
});
