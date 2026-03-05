jest.mock("@/lib/api", () => ({
    apiFetch: jest.fn(),
}));

import { useNotificationHistoryStore } from "@/stores/use-notification-history-store";
import { apiFetch } from "@/lib/api";

describe("useNotificationHistoryStore", () => {
    beforeEach(() => {
        useNotificationHistoryStore.setState({
            notifications: [],
            unreadCount: 0,
            loading: false,
            refreshing: false,
            pagination: { total: 0, skip: 0, take: 20, pages: 0 },
            error: null,
        });
        apiFetch.mockReset();
    });

    test("initial state has empty notifications", () => {
        expect(useNotificationHistoryStore.getState().notifications).toEqual([]);
    });

    test("initial state has unreadCount 0", () => {
        expect(useNotificationHistoryStore.getState().unreadCount).toBe(0);
    });

    test("initial state has loading false", () => {
        expect(useNotificationHistoryStore.getState().loading).toBe(false);
    });

    test("fetchHistory success sets notifications", async () => {
        const mockData = {
            notifications: [{ id: "1", title: "Test", isRead: false }],
            unreadCount: 1,
            pagination: { total: 1, skip: 0, take: 20, pages: 1 },
        };
        apiFetch.mockResolvedValueOnce(mockData);

        await useNotificationHistoryStore.getState().fetchHistory();

        expect(useNotificationHistoryStore.getState().notifications).toHaveLength(1);
        expect(useNotificationHistoryStore.getState().unreadCount).toBe(1);
    });

    test("fetchHistory with skip=0 replaces notifications", async () => {
        useNotificationHistoryStore.setState({
            notifications: [{ id: "old", title: "Old" }],
        });

        apiFetch.mockResolvedValueOnce({
            notifications: [{ id: "new", title: "New" }],
            unreadCount: 0,
            pagination: { total: 1, skip: 0, take: 20, pages: 1 },
        });

        await useNotificationHistoryStore.getState().fetchHistory({ skip: 0 });

        const notifications = useNotificationHistoryStore.getState().notifications;
        expect(notifications).toHaveLength(1);
        expect(notifications[0].id).toBe("new");
    });

    test("fetchHistory with skip > 0 appends notifications", async () => {
        useNotificationHistoryStore.setState({
            notifications: [{ id: "1", title: "First" }],
        });

        apiFetch.mockResolvedValueOnce({
            notifications: [{ id: "2", title: "Second" }],
            unreadCount: 0,
            pagination: { total: 2, skip: 1, take: 20, pages: 1 },
        });

        await useNotificationHistoryStore.getState().fetchHistory({ skip: 1 });

        expect(useNotificationHistoryStore.getState().notifications).toHaveLength(2);
    });

    test("fetchHistory with refresh sets refreshing", async () => {
        useNotificationHistoryStore.setState({
            notifications: [{ id: "1" }],
        });

        let resolve;
        apiFetch.mockReturnValue(new Promise((r) => { resolve = r; }));

        const promise = useNotificationHistoryStore.getState().fetchHistory({ refresh: true });
        expect(useNotificationHistoryStore.getState().refreshing).toBe(true);

        resolve({ notifications: [], unreadCount: 0, pagination: { total: 0, skip: 0, take: 20, pages: 0 } });
        await promise;
    });

    test("fetchHistory error sets error message", async () => {
        apiFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

        await useNotificationHistoryStore.getState().fetchHistory();

        expect(useNotificationHistoryStore.getState().error).toBe("Failed to fetch");
        expect(useNotificationHistoryStore.getState().loading).toBe(false);
    });

    test("fetchHistory calls correct API endpoint with params", async () => {
        apiFetch.mockResolvedValueOnce({
            notifications: [],
            unreadCount: 0,
            pagination: { total: 0, skip: 0, take: 20, pages: 0 },
        });

        await useNotificationHistoryStore.getState().fetchHistory({ skip: 10, take: 5 });

        expect(apiFetch).toHaveBeenCalledWith("/admin/notifications/history", {
            params: { skip: 10, take: 5 },
        });
    });

    test("markRead updates notification isRead to true", async () => {
        useNotificationHistoryStore.setState({
            notifications: [
                { id: "n1", isRead: false },
                { id: "n2", isRead: false },
            ],
            unreadCount: 2,
        });

        apiFetch.mockResolvedValueOnce({});

        await useNotificationHistoryStore.getState().markRead("n1");

        const state = useNotificationHistoryStore.getState();
        expect(state.notifications.find((n) => n.id === "n1").isRead).toBe(true);
        expect(state.notifications.find((n) => n.id === "n2").isRead).toBe(false);
    });

    test("markRead decrements unreadCount", async () => {
        useNotificationHistoryStore.setState({
            notifications: [{ id: "n1", isRead: false }],
            unreadCount: 3,
        });

        apiFetch.mockResolvedValueOnce({});
        await useNotificationHistoryStore.getState().markRead("n1");

        expect(useNotificationHistoryStore.getState().unreadCount).toBe(2);
    });

    test("markRead does not decrement if already read", async () => {
        useNotificationHistoryStore.setState({
            notifications: [{ id: "n1", isRead: true }],
            unreadCount: 1,
        });

        apiFetch.mockResolvedValueOnce({});
        await useNotificationHistoryStore.getState().markRead("n1");

        expect(useNotificationHistoryStore.getState().unreadCount).toBe(1);
    });

    test("markRead error sets error", async () => {
        useNotificationHistoryStore.setState({
            notifications: [{ id: "n1", isRead: false }],
        });

        apiFetch.mockRejectedValueOnce(new Error("Mark read failed"));
        await useNotificationHistoryStore.getState().markRead("n1");

        expect(useNotificationHistoryStore.getState().error).toBe("Mark read failed");
    });

    test("markAllRead sets all notifications to isRead true", async () => {
        useNotificationHistoryStore.setState({
            notifications: [
                { id: "n1", isRead: false },
                { id: "n2", isRead: false },
                { id: "n3", isRead: true },
            ],
            unreadCount: 2,
        });

        apiFetch.mockResolvedValueOnce({});
        await useNotificationHistoryStore.getState().markAllRead();

        const state = useNotificationHistoryStore.getState();
        expect(state.notifications.every((n) => n.isRead)).toBe(true);
        expect(state.unreadCount).toBe(0);
    });

    test("markAllRead error sets error", async () => {
        apiFetch.mockRejectedValueOnce(new Error("Mark all read failed"));
        await useNotificationHistoryStore.getState().markAllRead();

        expect(useNotificationHistoryStore.getState().error).toBe("Mark all read failed");
    });
});
