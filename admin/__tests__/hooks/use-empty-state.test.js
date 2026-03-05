import { renderHook } from "@testing-library/react";
import { useEmptyState } from "@/hooks/use-empty-state";

describe("useEmptyState", () => {
    const render = (isLoading, data, error) =>
        renderHook(() => useEmptyState(isLoading, data, error)).result.current;

    // ── isLoading ────────────────────────────────────────────────────────
    test("isLoading true + null data → isLoading true", () => {
        const state = render(true, null, null);
        expect(state.isLoading).toBe(true);
    });

    test("isLoading true + existing data → isLoading false", () => {
        const state = render(true, [1, 2], null);
        expect(state.isLoading).toBe(false);
    });

    test("isLoading false + null data → isLoading false", () => {
        const state = render(false, null, null);
        expect(state.isLoading).toBe(false);
    });

    // ── isEmpty ──────────────────────────────────────────────────────────
    test("null data → isEmpty true", () => {
        const state = render(false, null, null);
        expect(state.isEmpty).toBe(true);
    });

    test("undefined data → isEmpty true", () => {
        const state = render(false, undefined, null);
        expect(state.isEmpty).toBe(true);
    });

    test("empty array → isEmpty true", () => {
        const state = render(false, [], null);
        expect(state.isEmpty).toBe(true);
    });

    test("empty object → isEmpty true", () => {
        const state = render(false, {}, null);
        expect(state.isEmpty).toBe(true);
    });

    test("non-empty array → isEmpty false", () => {
        const state = render(false, [1], null);
        expect(state.isEmpty).toBe(false);
    });

    test("non-empty object → isEmpty false", () => {
        const state = render(false, { key: "value" }, null);
        expect(state.isEmpty).toBe(false);
    });

    // ── isError ──────────────────────────────────────────────────────────
    test("with error object → isError true", () => {
        const state = render(false, null, new Error("fail"));
        expect(state.isError).toBe(true);
    });

    test("without error → isError false", () => {
        const state = render(false, [1], null);
        expect(state.isError).toBe(false);
    });

    // ── showEmpty ────────────────────────────────────────────────────────
    test("not loading, no error, empty data → showEmpty true", () => {
        const state = render(false, [], null);
        expect(state.showEmpty).toBe(true);
    });

    test("loading → showEmpty false", () => {
        const state = render(true, null, null);
        expect(state.showEmpty).toBe(false);
    });

    // ── showContent ──────────────────────────────────────────────────────
    test("not loading, no error, non-empty data → showContent true", () => {
        const state = render(false, [1, 2, 3], null);
        expect(state.showContent).toBe(true);
    });

    test("loading → showContent false", () => {
        const state = render(true, null, null);
        expect(state.showContent).toBe(false);
    });

    test("error → showContent false", () => {
        const state = render(false, [1], new Error("fail"));
        expect(state.showContent).toBe(false);
    });

    // ── showError ────────────────────────────────────────────────────────
    test("error and not loading → showError true", () => {
        const state = render(false, null, new Error("fail"));
        expect(state.showError).toBe(true);
    });

    test("error and loading → showError false", () => {
        const state = render(true, null, new Error("fail"));
        expect(state.showError).toBe(false);
    });
});
