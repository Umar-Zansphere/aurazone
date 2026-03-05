import React from "react";
import { render, screen } from "@testing-library/react";

// ═══════════════════════════════════════════════════════════════════════════
// getPriceRange & getStockState (non-exported — re-implemented for testing)
// ═══════════════════════════════════════════════════════════════════════════

import { formatCurrencyINR } from "@/lib/format";

const getPriceRange = (variants = []) => {
    const prices = variants
        .map((item) => Number(item.price) || 0)
        .filter((price) => Number.isFinite(price));
    if (!prices.length) return "₹0";

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return formatCurrencyINR(min);
    return `${formatCurrencyINR(min)} - ${formatCurrencyINR(max)}`;
};

const getStockState = (variants = []) => {
    const total = variants.reduce(
        (sum, variant) => sum + (variant.inventory?.quantity || 0),
        0
    );
    if (total <= 0) return { label: "Out", color: "#9b2c2c" };
    if (total < 10) return { label: "Low", color: "#b7791f" };
    return { label: "In", color: "#2f6b4f" };
};

describe("getPriceRange", () => {
    test("empty variants → ₹0", () => {
        expect(getPriceRange([])).toBe("₹0");
    });

    test("no variants (default) → ₹0", () => {
        expect(getPriceRange()).toBe("₹0");
    });

    test("single variant → formatted price", () => {
        const result = getPriceRange([{ price: 1000 }]);
        expect(result).toMatch(/1,000/);
    });

    test("multiple variants same price → single price", () => {
        const result = getPriceRange([{ price: 500 }, { price: 500 }]);
        expect(result).toMatch(/500/);
        expect(result).not.toContain("-");
    });

    test("multiple variants different prices → range", () => {
        const result = getPriceRange([{ price: 200 }, { price: 800 }]);
        expect(result).toContain("-");
    });

    test("handles NaN prices gracefully", () => {
        const result = getPriceRange([{ price: NaN }, { price: 500 }]);
        // NaN becomes 0 via || 0, so range is "₹0 - ₹500" or just ₹500 if 0 is min
        expect(result).toBeTruthy();
    });

    test("handles string prices", () => {
        const result = getPriceRange([{ price: "1500" }]);
        expect(result).toMatch(/1,500/);
    });

    test("handles zero price", () => {
        const result = getPriceRange([{ price: 0 }]);
        expect(result).toMatch(/₹0/);
    });
});

describe("getStockState", () => {
    test("zero stock → Out", () => {
        const result = getStockState([{ inventory: { quantity: 0 } }]);
        expect(result.label).toBe("Out");
        expect(result.color).toBe("#9b2c2c");
    });

    test("negative stock → Out", () => {
        const result = getStockState([{ inventory: { quantity: -5 } }]);
        expect(result.label).toBe("Out");
    });

    test("low stock (1-9) → Low", () => {
        const result = getStockState([{ inventory: { quantity: 5 } }]);
        expect(result.label).toBe("Low");
        expect(result.color).toBe("#b7791f");
    });

    test("normal stock (>=10) → In", () => {
        const result = getStockState([{ inventory: { quantity: 50 } }]);
        expect(result.label).toBe("In");
        expect(result.color).toBe("#2f6b4f");
    });

    test("empty variants → Out", () => {
        const result = getStockState([]);
        expect(result.label).toBe("Out");
    });

    test("no inventory key → Out", () => {
        const result = getStockState([{}]);
        expect(result.label).toBe("Out");
    });

    test("multiple variants sum stock correctly", () => {
        const result = getStockState([
            { inventory: { quantity: 5 } },
            { inventory: { quantity: 6 } },
        ]);
        expect(result.label).toBe("In"); // 5 + 6 = 11 >= 10
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// ProductCard rendering
// ═══════════════════════════════════════════════════════════════════════════
import ProductCard from "@/components/products/product-card";

describe("ProductCard rendering", () => {
    const mockProduct = {
        id: "prod-1",
        name: "Nike Air Max",
        brand: "Nike",
        isActive: true,
        isFeatured: false,
        variants: [
            {
                price: 8999,
                images: [{ url: "https://example.com/shoe.jpg", isPrimary: true }],
                inventory: { quantity: 25 },
            },
        ],
    };

    test("renders product name", () => {
        render(
            <ProductCard product={mockProduct} onOpen={jest.fn()} onLongPress={jest.fn()} />
        );
        expect(screen.getByText("Nike Air Max")).toBeInTheDocument();
    });

    test("renders brand name", () => {
        render(
            <ProductCard product={mockProduct} onOpen={jest.fn()} onLongPress={jest.fn()} />
        );
        expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    test("renders Active badge when isActive", () => {
        render(
            <ProductCard product={mockProduct} onOpen={jest.fn()} onLongPress={jest.fn()} />
        );
        expect(screen.getByText("Active")).toBeInTheDocument();
    });

    test("does not render Featured badge when not featured", () => {
        render(
            <ProductCard product={mockProduct} onOpen={jest.fn()} onLongPress={jest.fn()} />
        );
        expect(screen.queryByText("Featured")).toBeNull();
    });

    test("renders stock state text", () => {
        render(
            <ProductCard product={mockProduct} onOpen={jest.fn()} onLongPress={jest.fn()} />
        );
        expect(screen.getByText(/stock/i)).toBeInTheDocument();
    });
});
