import manifest from "@/app/manifest";

describe("manifest", () => {
    const data = manifest();

    test("returns correct name", () => {
        expect(data.name).toBe("AuraZone Admin");
    });

    test("returns correct short_name", () => {
        expect(data.short_name).toBe("AuraAdmin");
    });

    test("has description", () => {
        expect(data.description).toBeTruthy();
    });

    test("display is standalone", () => {
        expect(data.display).toBe("standalone");
    });

    test("has theme_color", () => {
        expect(data.theme_color).toBe("#FF6B6B");
    });

    test("has background_color", () => {
        expect(data.background_color).toBe("#FAFAF8");
    });

    test("start_url is /", () => {
        expect(data.start_url).toBe("/");
    });

    test("icons is an array with 3 entries", () => {
        expect(Array.isArray(data.icons)).toBe(true);
        expect(data.icons).toHaveLength(3);
    });

    test("each icon has src, sizes, and type", () => {
        data.icons.forEach((icon) => {
            expect(icon).toHaveProperty("src");
            expect(icon).toHaveProperty("sizes");
            expect(icon).toHaveProperty("type");
        });
    });

    test("all icon types are image/png", () => {
        data.icons.forEach((icon) => {
            expect(icon.type).toBe("image/png");
        });
    });
});
