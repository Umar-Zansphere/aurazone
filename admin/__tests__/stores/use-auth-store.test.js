/**
 * Tests for useAuthStore (Zustand store)
 * We mock apiFetch and test the store's state transitions.
 */

jest.mock("@/lib/api", () => ({
    apiFetch: jest.fn(),
}));

import { useAuthStore } from "@/stores/use-auth-store";
import { apiFetch } from "@/lib/api";

describe("useAuthStore", () => {
    beforeEach(() => {
        // Reset store to initial state
        useAuthStore.setState({ user: null, loading: false, error: null });
        apiFetch.mockReset();
    });

    test("initial state has null user", () => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
    });

    test("initial state has loading false", () => {
        expect(useAuthStore.getState().loading).toBe(false);
    });

    test("initial state has null error", () => {
        expect(useAuthStore.getState().error).toBeNull();
    });

    test("setUser updates user", () => {
        useAuthStore.getState().setUser({ id: "1", name: "Admin" });
        expect(useAuthStore.getState().user).toEqual({ id: "1", name: "Admin" });
    });

    test("setUser can set user to null", () => {
        useAuthStore.getState().setUser({ id: "1" });
        useAuthStore.getState().setUser(null);
        expect(useAuthStore.getState().user).toBeNull();
    });

    test("clearError sets error to null", () => {
        useAuthStore.setState({ error: "some error" });
        useAuthStore.getState().clearError();
        expect(useAuthStore.getState().error).toBeNull();
    });

    test("login sets loading to true during request", async () => {
        let resolvePromise;
        apiFetch.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

        const loginPromise = useAuthStore.getState().login({ email: "a@b.com", password: "pass" });
        expect(useAuthStore.getState().loading).toBe(true);

        resolvePromise({ user: { id: "1" } });
        await loginPromise;
    });

    test("login success sets user and loading false", async () => {
        apiFetch.mockResolvedValueOnce({ user: { id: "1", name: "Admin" } });
        await useAuthStore.getState().login({ email: "a@b.com", password: "pass" });

        expect(useAuthStore.getState().user).toEqual({ id: "1", name: "Admin" });
        expect(useAuthStore.getState().loading).toBe(false);
    });

    test("login success returns data", async () => {
        apiFetch.mockResolvedValueOnce({ user: { id: "1" }, token: "abc" });
        const result = await useAuthStore.getState().login({ email: "a@b.com", password: "pass" });

        expect(result).toEqual({ user: { id: "1" }, token: "abc" });
    });

    test("login calls apiFetch with correct path and method", async () => {
        apiFetch.mockResolvedValueOnce({ user: null });
        await useAuthStore.getState().login({ email: "a@b.com", password: "pass" });

        expect(apiFetch).toHaveBeenCalledWith("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: "a@b.com", password: "pass" }),
        });
    });

    test("login error sets error message and loading false", async () => {
        apiFetch.mockRejectedValueOnce(new Error("Invalid credentials"));

        await expect(
            useAuthStore.getState().login({ email: "a@b.com", password: "bad" })
        ).rejects.toThrow("Invalid credentials");

        expect(useAuthStore.getState().error).toBe("Invalid credentials");
        expect(useAuthStore.getState().loading).toBe(false);
    });

    test("logout success clears user", async () => {
        useAuthStore.setState({ user: { id: "1" } });
        apiFetch.mockResolvedValueOnce({});

        await useAuthStore.getState().logout();
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().loading).toBe(false);
    });

    test("logout calls apiFetch with POST", async () => {
        apiFetch.mockResolvedValueOnce({});
        await useAuthStore.getState().logout();

        expect(apiFetch).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
    });

    test("logout error sets error message", async () => {
        apiFetch.mockRejectedValueOnce(new Error("Logout failed"));

        await expect(useAuthStore.getState().logout()).rejects.toThrow("Logout failed");
        expect(useAuthStore.getState().error).toBe("Logout failed");
    });
});
