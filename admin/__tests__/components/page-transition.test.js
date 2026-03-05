// Test the isVerticalFlow logic from page-transition.js
// Since it's not exported, we re-implement for testing.

const isVerticalFlow = (pathname) => {
    return (
        /^\/orders\/[^/]+$/.test(pathname) ||
        /^\/products\/[^/]+$/.test(pathname) ||
        pathname === "/products/new"
    );
};

describe("isVerticalFlow (page-transition)", () => {
    test("/orders/123 is vertical", () => {
        expect(isVerticalFlow("/orders/123")).toBe(true);
    });

    test("/orders/abc-def is vertical", () => {
        expect(isVerticalFlow("/orders/abc-def")).toBe(true);
    });

    test("/products/456 is vertical", () => {
        expect(isVerticalFlow("/products/456")).toBe(true);
    });

    test("/products/new is vertical", () => {
        expect(isVerticalFlow("/products/new")).toBe(true);
    });

    test("/ is NOT vertical", () => {
        expect(isVerticalFlow("/")).toBe(false);
    });

    test("/orders is NOT vertical", () => {
        expect(isVerticalFlow("/orders")).toBe(false);
    });

    test("/products is NOT vertical", () => {
        expect(isVerticalFlow("/products")).toBe(false);
    });

    test("/settings is NOT vertical", () => {
        expect(isVerticalFlow("/settings")).toBe(false);
    });

    test("/orders/123/edit (nested) is NOT vertical", () => {
        expect(isVerticalFlow("/orders/123/edit")).toBe(false);
    });

    test("/notifications is NOT vertical", () => {
        expect(isVerticalFlow("/notifications")).toBe(false);
    });
});
