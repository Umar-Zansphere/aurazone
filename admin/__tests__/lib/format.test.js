import {
    formatCurrencyINR,
    formatCompactCurrencyINR,
    formatRelativeTime,
    formatDate,
    formatDateTime,
    statusTone,
    shipmentTone,
    paymentTone,
} from "@/lib/format";

// ═══════════════════════════════════════════════════════════════════════════
// formatCurrencyINR
// ═══════════════════════════════════════════════════════════════════════════
describe("formatCurrencyINR", () => {
    test("formats zero as ₹0", () => {
        expect(formatCurrencyINR(0)).toMatch(/₹0/);
    });

    test("formats positive integer", () => {
        expect(formatCurrencyINR(1000)).toMatch(/1,000/);
    });

    test("formats large number with Indian grouping", () => {
        const result = formatCurrencyINR(1500000);
        expect(result).toMatch(/15,00,000/);
    });

    test("rounds decimals (maximumFractionDigits: 0)", () => {
        const result = formatCurrencyINR(999.99);
        expect(result).toMatch(/1,000/);
    });

    test("handles negative value", () => {
        const result = formatCurrencyINR(-500);
        expect(result).toMatch(/500/);
    });

    test("handles NaN input → returns ₹0", () => {
        expect(formatCurrencyINR(NaN)).toMatch(/₹0/);
    });

    test("handles undefined (default param) → returns ₹0", () => {
        expect(formatCurrencyINR()).toMatch(/₹0/);
    });

    test("handles null → returns ₹0", () => {
        expect(formatCurrencyINR(null)).toMatch(/₹0/);
    });

    test("handles string number", () => {
        expect(formatCurrencyINR("2500")).toMatch(/2,500/);
    });

    test("handles empty string → returns ₹0", () => {
        expect(formatCurrencyINR("")).toMatch(/₹0/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatCompactCurrencyINR
// ═══════════════════════════════════════════════════════════════════════════
describe("formatCompactCurrencyINR", () => {
    test("formats zero", () => {
        expect(formatCompactCurrencyINR(0)).toMatch(/₹0/);
    });

    test("formats thousands compactly", () => {
        const result = formatCompactCurrencyINR(1500);
        expect(result).toBeTruthy();
    });

    test("formats lakhs compactly", () => {
        const result = formatCompactCurrencyINR(150000);
        expect(result).toBeTruthy();
    });

    test("handles NaN → ₹0", () => {
        expect(formatCompactCurrencyINR(NaN)).toMatch(/₹0/);
    });

    test("handles undefined (default param)", () => {
        expect(formatCompactCurrencyINR()).toMatch(/₹0/);
    });

    test("handles string number", () => {
        const result = formatCompactCurrencyINR("50000");
        expect(result).toBeTruthy();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatRelativeTime
// ═══════════════════════════════════════════════════════════════════════════
describe("formatRelativeTime", () => {
    test("returns 'now' for null input", () => {
        expect(formatRelativeTime(null)).toBe("now");
    });

    test("returns 'now' for undefined input", () => {
        expect(formatRelativeTime(undefined)).toBe("now");
    });

    test("returns 'just now' for a date within last minute", () => {
        const recent = new Date(Date.now() - 10 * 1000).toISOString();
        expect(formatRelativeTime(recent)).toBe("just now");
    });

    test("returns minutes ago for 5 min in the past", () => {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const result = formatRelativeTime(fiveMinAgo);
        expect(result).toMatch(/5 minutes ago/);
    });

    test("returns hours ago for 3 hours in the past", () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const result = formatRelativeTime(threeHoursAgo);
        expect(result).toMatch(/3 hours ago/);
    });

    test("returns days ago for 2 days in the past", () => {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const result = formatRelativeTime(twoDaysAgo);
        expect(result).toMatch(/2 days ago/);
    });

    test("handles future dates (in minutes)", () => {
        const fiveMinLater = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const result = formatRelativeTime(fiveMinLater);
        expect(result).toMatch(/in 5 minutes/);
    });

    test("handles future dates (in hours)", () => {
        const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const result = formatRelativeTime(twoHoursLater);
        expect(result).toMatch(/in 2 hours/);
    });

    test("returns 'now' for empty string", () => {
        expect(formatRelativeTime("")).toBe("now");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatDate
// ═══════════════════════════════════════════════════════════════════════════
describe("formatDate", () => {
    test("returns '—' for null", () => {
        expect(formatDate(null)).toBe("—");
    });

    test("returns '—' for undefined", () => {
        expect(formatDate(undefined)).toBe("—");
    });

    test("returns '—' for empty string", () => {
        expect(formatDate("")).toBe("—");
    });

    test("formats a valid ISO date string", () => {
        const result = formatDate("2026-01-15T00:00:00Z");
        expect(result).toBeTruthy();
        expect(result).not.toBe("—");
    });

    test("formats a Date object", () => {
        const result = formatDate(new Date("2026-06-20"));
        expect(result).toBeTruthy();
        expect(result).not.toBe("—");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatDateTime
// ═══════════════════════════════════════════════════════════════════════════
describe("formatDateTime", () => {
    test("returns '—' for null", () => {
        expect(formatDateTime(null)).toBe("—");
    });

    test("returns '—' for undefined", () => {
        expect(formatDateTime(undefined)).toBe("—");
    });

    test("formats a valid date with time", () => {
        const result = formatDateTime("2026-03-01T14:30:00Z");
        expect(result).toBeTruthy();
        expect(result).not.toBe("—");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tone maps
// ═══════════════════════════════════════════════════════════════════════════
describe("statusTone", () => {
    test("has PENDING key", () => {
        expect(statusTone.PENDING).toBe("#b7791f");
    });

    test("has PAID key", () => {
        expect(statusTone.PAID).toBe("#3b6b8c");
    });

    test("has SHIPPED key", () => {
        expect(statusTone.SHIPPED).toBe("#a18a68");
    });

    test("has DELIVERED key", () => {
        expect(statusTone.DELIVERED).toBe("#2f6b4f");
    });

    test("has CANCELLED key", () => {
        expect(statusTone.CANCELLED).toBe("#9a9a9a");
    });

    test("has exactly 5 keys", () => {
        expect(Object.keys(statusTone)).toHaveLength(5);
    });
});

describe("shipmentTone", () => {
    test("has PENDING key", () => {
        expect(shipmentTone.PENDING).toBe("#b7791f");
    });

    test("has RETURNED key", () => {
        expect(shipmentTone.RETURNED).toBe("#9b2c2c");
    });

    test("has LOST key", () => {
        expect(shipmentTone.LOST).toBe("#9b2c2c");
    });

    test("has exactly 5 keys", () => {
        expect(Object.keys(shipmentTone)).toHaveLength(5);
    });
});

describe("paymentTone", () => {
    test("has PENDING key", () => {
        expect(paymentTone.PENDING).toBe("#b7791f");
    });

    test("has COMPLETED key", () => {
        expect(paymentTone.COMPLETED).toBe("#2f6b4f");
    });

    test("has FAILED key", () => {
        expect(paymentTone.FAILED).toBe("#9b2c2c");
    });

    test("has REFUNDED key", () => {
        expect(paymentTone.REFUNDED).toBe("#3b6b8c");
    });

    test("has exactly 6 keys", () => {
        expect(Object.keys(paymentTone)).toHaveLength(6);
    });
});
