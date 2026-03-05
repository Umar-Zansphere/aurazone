import { ApiError, apiFetch } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════
// ApiError
// ═══════════════════════════════════════════════════════════════════════════
describe("ApiError", () => {
    test("sets message correctly", () => {
        const err = new ApiError("Not found", 404, null);
        expect(err.message).toBe("Not found");
    });

    test("sets status correctly", () => {
        const err = new ApiError("Unauthorized", 401, null);
        expect(err.status).toBe(401);
    });

    test("sets details correctly", () => {
        const details = { field: "email" };
        const err = new ApiError("Validation", 422, details);
        expect(err.details).toEqual(details);
    });

    test("has name 'ApiError'", () => {
        const err = new ApiError("fail", 500, null);
        expect(err.name).toBe("ApiError");
    });

    test("is an instance of Error", () => {
        const err = new ApiError("fail", 500, null);
        expect(err).toBeInstanceOf(Error);
    });

    test("is an instance of ApiError", () => {
        const err = new ApiError("fail", 500, null);
        expect(err).toBeInstanceOf(ApiError);
    });

    test("has stack trace", () => {
        const err = new ApiError("test", 400, null);
        expect(err.stack).toBeTruthy();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// apiFetch
// ═══════════════════════════════════════════════════════════════════════════
describe("apiFetch", () => {
    beforeEach(() => {
        global.fetch.mockReset();
    });

    const jsonResponse = (body, status = 200) => ({
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (key) => (key === "content-type" ? "application/json" : null),
        },
        json: () => Promise.resolve(body),
    });

    const nonJsonResponse = (status = 200) => ({
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: () => "text/html",
        },
        json: () => Promise.resolve(null),
    });

    test("makes GET request to correct URL", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
        await apiFetch("/test");
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const url = global.fetch.mock.calls[0][0];
        expect(url).toContain("/api/test");
    });

    test("includes credentials: include", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/test");
        const options = global.fetch.mock.calls[0][1];
        expect(options.credentials).toBe("include");
    });

    test("sets Content-Type to application/json by default", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/test");
        const options = global.fetch.mock.calls[0][1];
        expect(options.headers["Content-Type"]).toBe("application/json");
    });

    test("sets ngrok-skip-browser-warning header", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/test");
        const options = global.fetch.mock.calls[0][1];
        expect(options.headers["ngrok-skip-browser-warning"]).toBe("true");
    });

    test("sets cache to no-store", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/test");
        const options = global.fetch.mock.calls[0][1];
        expect(options.cache).toBe("no-store");
    });

    test("returns parsed JSON on success", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({ data: "hello" }));
        const result = await apiFetch("/test");
        expect(result).toEqual({ data: "hello" });
    });

    test("returns null for non-JSON response", async () => {
        global.fetch.mockResolvedValueOnce(nonJsonResponse(200));
        const result = await apiFetch("/test");
        expect(result).toBeNull();
    });

    test("throws ApiError on non-OK status with JSON body", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({ message: "Not found" }, 404));
        await expect(apiFetch("/test")).rejects.toThrow(ApiError);
    });

    test("thrown ApiError has correct status", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401));
        try {
            await apiFetch("/test");
        } catch (err) {
            expect(err.status).toBe(401);
        }
    });

    test("thrown ApiError has message from payload", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({ message: "Custom error" }, 500));
        try {
            await apiFetch("/test");
        } catch (err) {
            expect(err.message).toBe("Custom error");
        }
    });

    test("thrown ApiError falls back to 'Request failed' when no message", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}, 500));
        try {
            await apiFetch("/test");
        } catch (err) {
            expect(err.message).toBe("Request failed");
        }
    });

    test("appends query params to URL", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/search", { params: { q: "shoes", page: 1 } });
        const url = global.fetch.mock.calls[0][0];
        expect(url).toContain("q=shoes");
        expect(url).toContain("page=1");
    });

    test("filters out null params", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/search", { params: { q: "test", empty: null } });
        const url = global.fetch.mock.calls[0][0];
        expect(url).toContain("q=test");
        expect(url).not.toContain("empty");
    });

    test("filters out undefined params", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/search", { params: { q: "test", missing: undefined } });
        const url = global.fetch.mock.calls[0][0];
        expect(url).not.toContain("missing");
    });

    test("filters out empty string params", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/search", { params: { q: "test", blank: "" } });
        const url = global.fetch.mock.calls[0][0];
        expect(url).not.toContain("blank");
    });

    test("passes custom headers alongside defaults", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/test", { headers: { "X-Custom": "value" } });
        const options = global.fetch.mock.calls[0][1];
        expect(options.headers["X-Custom"]).toBe("value");
        expect(options.headers["Content-Type"]).toBe("application/json");
    });

    test("passes method option", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch("/test", { method: "POST", body: JSON.stringify({}) });
        const options = global.fetch.mock.calls[0][1];
        expect(options.method).toBe("POST");
    });

    test("does not set Content-Type for FormData body", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({}));
        const formData = new FormData();
        formData.append("file", "data");
        await apiFetch("/upload", { method: "POST", body: formData });
        const options = global.fetch.mock.calls[0][1];
        expect(options.headers["Content-Type"]).toBeUndefined();
    });
});
