/* eslint-disable no-undef */
import "@testing-library/jest-dom";

// ── Mock: next/navigation ───────────────────────────────────────────────────
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        prefetch: jest.fn(),
        pathname: "/",
    }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
}));

// ── Mock: next/image ────────────────────────────────────────────────────────
jest.mock("next/image", () => {
    const MockImage = (props) => {
        const { fill, priority, unoptimized, ...rest } = props;
        return <img {...rest} />;
    };
    MockImage.displayName = "MockImage";
    return { __esModule: true, default: MockImage };
});

// ── Mock: framer-motion ─────────────────────────────────────────────────────
jest.mock("framer-motion", () => {
    const actual = jest.requireActual("framer-motion");
    const React = require("react");

    const createMotionProxy = () =>
        new Proxy(
            {},
            {
                get: (_target, prop) => {
                    return React.forwardRef((props, ref) => {
                        const {
                            initial,
                            animate,
                            exit,
                            transition,
                            variants,
                            whileTap,
                            whileHover,
                            drag,
                            dragConstraints,
                            dragElastic,
                            onDragEnd,
                            layout,
                            ...rest
                        } = props;
                        return React.createElement(String(prop), { ...rest, ref });
                    });
                },
            }
        );

    return {
        ...actual,
        motion: createMotionProxy(),
        AnimatePresence: ({ children }) => children,
        useMotionValue: (val) => ({ get: () => val, set: jest.fn() }),
        useTransform: (_mv, fn) => fn(0),
        animate: () => ({ stop: jest.fn() }),
    };
});

// ── Mock: global fetch ──────────────────────────────────────────────────────
global.fetch = jest.fn();

// ── Mock: window.location ───────────────────────────────────────────────────
if (typeof window !== "undefined" && !window.location.origin) {
    Object.defineProperty(window, "location", {
        value: { origin: "http://localhost:3000", href: "http://localhost:3000" },
        writable: true,
    });
}

// ── Mock: IntersectionObserver ───────────────────────────────────────────────
class MockIntersectionObserver {
    constructor() {
        this.observe = jest.fn();
        this.unobserve = jest.fn();
        this.disconnect = jest.fn();
    }
}
global.IntersectionObserver = MockIntersectionObserver;

// ── Mock: ResizeObserver ────────────────────────────────────────────────────
class MockResizeObserver {
    constructor() {
        this.observe = jest.fn();
        this.unobserve = jest.fn();
        this.disconnect = jest.fn();
    }
}
global.ResizeObserver = MockResizeObserver;
