import { fallbackDashboard } from "@/lib/sample-data";

describe("fallbackDashboard", () => {
    test("has todayRevenue as a number", () => {
        expect(typeof fallbackDashboard.todayRevenue).toBe("number");
    });

    test("has todayOrders as a number", () => {
        expect(typeof fallbackDashboard.todayOrders).toBe("number");
    });

    test("has pendingOrders as a number", () => {
        expect(typeof fallbackDashboard.pendingOrders).toBe("number");
    });

    test("has revenueTimeseries as an array", () => {
        expect(Array.isArray(fallbackDashboard.revenueTimeseries)).toBe(true);
    });

    test("revenueTimeseries has 7 entries", () => {
        expect(fallbackDashboard.revenueTimeseries).toHaveLength(7);
    });

    test("each timeseries entry has date and revenue", () => {
        fallbackDashboard.revenueTimeseries.forEach((entry) => {
            expect(entry).toHaveProperty("date");
            expect(entry).toHaveProperty("revenue");
        });
    });

    test("has statusBreakdown as an object with expected keys", () => {
        const keys = Object.keys(fallbackDashboard.statusBreakdown);
        expect(keys).toContain("PENDING");
        expect(keys).toContain("DELIVERED");
    });

    test("has lowStockCount as a number", () => {
        expect(typeof fallbackDashboard.lowStockCount).toBe("number");
    });

    test("has topProduct with name, imageUrl, and unitsSold", () => {
        expect(fallbackDashboard.topProduct).toHaveProperty("name");
        expect(fallbackDashboard.topProduct).toHaveProperty("imageUrl");
        expect(fallbackDashboard.topProduct).toHaveProperty("unitsSold");
    });

    test("has activityFeed as a non-empty array", () => {
        expect(Array.isArray(fallbackDashboard.activityFeed)).toBe(true);
        expect(fallbackDashboard.activityFeed.length).toBeGreaterThan(0);
    });

    test("each activity feed item has type, title, and createdAt", () => {
        fallbackDashboard.activityFeed.forEach((item) => {
            expect(item).toHaveProperty("type");
            expect(item).toHaveProperty("title");
            expect(item).toHaveProperty("createdAt");
        });
    });

    test("activityFeed items have valid ISO date strings for createdAt", () => {
        fallbackDashboard.activityFeed.forEach((item) => {
            expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt);
        });
    });
});
