import { renderHook, act } from "@testing-library/react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

describe("useScrollDirection", () => {
    let scrollListeners = [];

    beforeEach(() => {
        scrollListeners = [];
        Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });

        jest.spyOn(window, "addEventListener").mockImplementation((event, handler) => {
            if (event === "scroll") {
                scrollListeners.push(handler);
            }
        });

        jest.spyOn(window, "removeEventListener").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const fireScroll = (scrollY) => {
        window.scrollY = scrollY;
        scrollListeners.forEach((fn) => fn());
    };

    test("initial direction is 'up'", () => {
        const { result } = renderHook(() => useScrollDirection());
        expect(result.current.direction).toBe("up");
    });

    test("initial isTop is true", () => {
        const { result } = renderHook(() => useScrollDirection());
        expect(result.current.isTop).toBe(true);
    });

    test("scrolling down past threshold sets direction to 'down'", () => {
        const { result } = renderHook(() => useScrollDirection());

        act(() => {
            fireScroll(0); // initial
        });

        act(() => {
            fireScroll(50); // scroll down past threshold (delta > 6)
        });

        expect(result.current.direction).toBe("down");
    });

    test("scrolling up past threshold sets direction to 'up'", () => {
        const { result } = renderHook(() => useScrollDirection());

        act(() => {
            fireScroll(100);
        });

        act(() => {
            fireScroll(50); // scroll up (delta < -6)
        });

        expect(result.current.direction).toBe("up");
    });

    test("small scroll delta does not change direction", () => {
        const { result } = renderHook(() => useScrollDirection());

        act(() => {
            fireScroll(0);
        });

        act(() => {
            fireScroll(3); // delta = 3, less than threshold of 6
        });

        expect(result.current.direction).toBe("up");
    });

    test("isTop is true when scrollY < 24", () => {
        const { result } = renderHook(() => useScrollDirection());

        act(() => {
            fireScroll(10);
        });

        expect(result.current.isTop).toBe(true);
    });

    test("isTop is false when scrollY >= 24", () => {
        const { result } = renderHook(() => useScrollDirection());

        act(() => {
            fireScroll(100);
        });

        expect(result.current.isTop).toBe(false);
    });

    test("registers scroll listener on mount", () => {
        renderHook(() => useScrollDirection());
        expect(scrollListeners.length).toBeGreaterThan(0);
    });
});
