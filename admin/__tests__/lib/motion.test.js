import {
    spring,
    horizontalPageVariants,
    verticalPageVariants,
    staggerContainer,
    listItem,
} from "@/lib/motion";

describe("spring", () => {
    test("has type 'spring'", () => {
        expect(spring.type).toBe("spring");
    });

    test("has stiffness", () => {
        expect(spring.stiffness).toBe(300);
    });

    test("has damping", () => {
        expect(spring.damping).toBe(25);
    });
});

describe("horizontalPageVariants", () => {
    test("initial has x offset", () => {
        expect(horizontalPageVariants.initial.x).toBe(56);
    });

    test("initial has opacity 0", () => {
        expect(horizontalPageVariants.initial.opacity).toBe(0);
    });

    test("animate has x 0", () => {
        expect(horizontalPageVariants.animate.x).toBe(0);
    });

    test("animate has opacity 1", () => {
        expect(horizontalPageVariants.animate.opacity).toBe(1);
    });

    test("exit has negative x", () => {
        expect(horizontalPageVariants.exit.x).toBe(-56);
    });
});

describe("verticalPageVariants", () => {
    test("initial has y offset", () => {
        expect(verticalPageVariants.initial.y).toBe(56);
    });

    test("animate has y 0", () => {
        expect(verticalPageVariants.animate.y).toBe(0);
    });

    test("exit has y offset", () => {
        expect(verticalPageVariants.exit.y).toBe(24);
    });
});

describe("staggerContainer", () => {
    test("has animate.transition.staggerChildren", () => {
        expect(staggerContainer.animate.transition.staggerChildren).toBe(0.05);
    });
});

describe("listItem", () => {
    test("initial has opacity 0", () => {
        expect(listItem.initial.opacity).toBe(0);
    });

    test("initial has y 20", () => {
        expect(listItem.initial.y).toBe(20);
    });

    test("animate has opacity 1", () => {
        expect(listItem.animate.opacity).toBe(1);
    });

    test("animate has y 0", () => {
        expect(listItem.animate.y).toBe(0);
    });
});
