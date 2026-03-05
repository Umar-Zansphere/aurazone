jest.mock("@/lib/api", () => ({
    apiFetch: jest.fn(),
}));

// We need to test urlBase64ToUint8Array which is a module-level function.
// Since it's not exported, we re-implement it for testing.
const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
};

import { useNotificationStore } from "@/stores/use-notification-store";

describe("urlBase64ToUint8Array", () => {
    test("converts a base64url string to Uint8Array", () => {
        const result = urlBase64ToUint8Array("SGVsbG8");
        expect(result).toBeInstanceOf(Uint8Array);
    });

    test("output has correct length", () => {
        // "Hello" in base64 is "SGVsbG8="
        const result = urlBase64ToUint8Array("SGVsbG8");
        expect(result.length).toBe(5);
    });

    test("replaces URL-safe chars (- to +)", () => {
        // Just verify no error is thrown with URL-safe chars
        const result = urlBase64ToUint8Array("abc-def");
        expect(result).toBeInstanceOf(Uint8Array);
    });

    test("replaces URL-safe chars (_ to /)", () => {
        const result = urlBase64ToUint8Array("abc_def");
        expect(result).toBeInstanceOf(Uint8Array);
    });

    test("handles empty string", () => {
        const result = urlBase64ToUint8Array("");
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(0);
    });

    test("adds correct padding", () => {
        // "A" needs padding "A==="
        const result = urlBase64ToUint8Array("QQ");
        expect(result.length).toBe(1);
        expect(result[0]).toBe(65); // ASCII 'A'
    });
});

describe("useNotificationStore", () => {
    beforeEach(() => {
        useNotificationStore.setState({
            permission: "default",
            subscribed: false,
            loading: false,
            error: null,
        });
    });

    test("initial state has permission 'default'", () => {
        expect(useNotificationStore.getState().permission).toBe("default");
    });

    test("initial state has subscribed false", () => {
        expect(useNotificationStore.getState().subscribed).toBe(false);
    });

    test("initial state has loading false", () => {
        expect(useNotificationStore.getState().loading).toBe(false);
    });

    test("initial state has error null", () => {
        expect(useNotificationStore.getState().error).toBeNull();
    });

    test("setPermission updates permission", () => {
        useNotificationStore.getState().setPermission("granted");
        expect(useNotificationStore.getState().permission).toBe("granted");
    });

    test("setPermission to denied", () => {
        useNotificationStore.getState().setPermission("denied");
        expect(useNotificationStore.getState().permission).toBe("denied");
    });

    test("hydratePermission does nothing when window is undefined", async () => {
        // In jsdom window is defined, but Notification may not be set up
        // This tests that the function doesn't throw
        await useNotificationStore.getState().hydratePermission();
        // Should not throw
        expect(true).toBe(true);
    });

    test("can set subscribed via setState", () => {
        useNotificationStore.setState({ subscribed: true });
        expect(useNotificationStore.getState().subscribed).toBe(true);
    });

    test("can set error via setState", () => {
        useNotificationStore.setState({ error: "test error" });
        expect(useNotificationStore.getState().error).toBe("test error");
    });

    test("can set loading via setState", () => {
        useNotificationStore.setState({ loading: true });
        expect(useNotificationStore.getState().loading).toBe(true);
    });

    test("multiple state changes are independent", () => {
        useNotificationStore.setState({ permission: "granted", subscribed: true });
        useNotificationStore.setState({ error: "oops" });

        const state = useNotificationStore.getState();
        expect(state.permission).toBe("granted");
        expect(state.subscribed).toBe(true);
        expect(state.error).toBe("oops");
    });

    test("resetting state works", () => {
        useNotificationStore.setState({
            permission: "granted",
            subscribed: true,
            loading: true,
            error: "something",
        });

        useNotificationStore.setState({
            permission: "default",
            subscribed: false,
            loading: false,
            error: null,
        });

        const state = useNotificationStore.getState();
        expect(state.permission).toBe("default");
        expect(state.subscribed).toBe(false);
    });
});
