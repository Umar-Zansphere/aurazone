import { renderHook, act } from "@testing-library/react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

describe("usePullToRefresh", () => {
    beforeEach(() => {
        Object.defineProperty(window, "scrollY", { value: 0, writable: true });
    });

    test("initial pullDistance is 0", () => {
        const { result } = renderHook(() => usePullToRefresh(jest.fn()));
        expect(result.current.pullDistance).toBe(0);
    });

    test("initial refreshing is false", () => {
        const { result } = renderHook(() => usePullToRefresh(jest.fn()));
        expect(result.current.refreshing).toBe(false);
    });

    test("returns bind object with touch handlers", () => {
        const { result } = renderHook(() => usePullToRefresh(jest.fn()));
        expect(result.current.bind).toHaveProperty("onTouchStart");
        expect(result.current.bind).toHaveProperty("onTouchMove");
        expect(result.current.bind).toHaveProperty("onTouchEnd");
    });

    test("onTouchStart does nothing when scrollY > 0", () => {
        window.scrollY = 100;
        const { result } = renderHook(() => usePullToRefresh(jest.fn()));

        act(() => {
            result.current.bind.onTouchStart({ touches: [{ clientY: 100 }] });
        });

        // Pull distance should remain 0 since touch shouldn't be active
        expect(result.current.pullDistance).toBe(0);
    });

    test("touch move updates pullDistance when active", () => {
        const { result } = renderHook(() => usePullToRefresh(jest.fn()));

        act(() => {
            result.current.bind.onTouchStart({ touches: [{ clientY: 0 }] });
        });

        act(() => {
            result.current.bind.onTouchMove({ touches: [{ clientY: 100 }] });
        });

        expect(result.current.pullDistance).toBeGreaterThan(0);
    });

    test("pullDistance is capped at 120", () => {
        const { result } = renderHook(() => usePullToRefresh(jest.fn()));

        act(() => {
            result.current.bind.onTouchStart({ touches: [{ clientY: 0 }] });
        });

        act(() => {
            result.current.bind.onTouchMove({ touches: [{ clientY: 500 }] });
        });

        expect(result.current.pullDistance).toBeLessThanOrEqual(120);
    });

    test("touch end below threshold does not trigger refresh", async () => {
        const onRefresh = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => usePullToRefresh(onRefresh, 72));

        act(() => {
            result.current.bind.onTouchStart({ touches: [{ clientY: 0 }] });
        });

        act(() => {
            result.current.bind.onTouchMove({ touches: [{ clientY: 30 }] });
        });

        await act(async () => {
            await result.current.bind.onTouchEnd();
        });

        expect(onRefresh).not.toHaveBeenCalled();
    });

    test("touch end above threshold triggers refresh", async () => {
        const onRefresh = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => usePullToRefresh(onRefresh, 40));

        act(() => {
            result.current.bind.onTouchStart({ touches: [{ clientY: 0 }] });
        });

        act(() => {
            // Pull far enough: 200 * 0.55 = 110, which is > 40 threshold
            result.current.bind.onTouchMove({ touches: [{ clientY: 200 }] });
        });

        await act(async () => {
            await result.current.bind.onTouchEnd();
        });

        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    test("pullDistance resets to 0 after touch end", async () => {
        const onRefresh = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => usePullToRefresh(onRefresh));

        act(() => {
            result.current.bind.onTouchStart({ touches: [{ clientY: 0 }] });
        });

        act(() => {
            result.current.bind.onTouchMove({ touches: [{ clientY: 50 }] });
        });

        await act(async () => {
            await result.current.bind.onTouchEnd();
        });

        expect(result.current.pullDistance).toBe(0);
    });

    test("touch end without active does nothing", async () => {
        const onRefresh = jest.fn();
        const { result } = renderHook(() => usePullToRefresh(onRefresh));

        // Call touch end without touch start
        await act(async () => {
            await result.current.bind.onTouchEnd();
        });

        expect(onRefresh).not.toHaveBeenCalled();
    });
});
