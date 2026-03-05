import React from "react";
import { render, screen } from "@testing-library/react";
import { getNextStatus } from "@/components/orders/order-card";

// ═══════════════════════════════════════════════════════════════════════════
// getNextStatus (exported helper)
// ═══════════════════════════════════════════════════════════════════════════
describe("getNextStatus", () => {
    test("PENDING → PAID", () => {
        expect(getNextStatus("PENDING")).toBe("PAID");
    });

    test("PAID → SHIPPED", () => {
        expect(getNextStatus("PAID")).toBe("SHIPPED");
    });

    test("SHIPPED → DELIVERED", () => {
        expect(getNextStatus("SHIPPED")).toBe("DELIVERED");
    });

    test("DELIVERED → null", () => {
        expect(getNextStatus("DELIVERED")).toBeNull();
    });

    test("CANCELLED → null", () => {
        expect(getNextStatus("CANCELLED")).toBeNull();
    });

    test("unknown status → null", () => {
        expect(getNextStatus("UNKNOWN")).toBeNull();
    });

    test("undefined → null", () => {
        expect(getNextStatus(undefined)).toBeNull();
    });

    test("null → null", () => {
        expect(getNextStatus(null)).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// OrderCard rendering
// ═══════════════════════════════════════════════════════════════════════════
import OrderCard from "@/components/orders/order-card";

describe("OrderCard rendering", () => {
    const mockOrder = {
        id: "order-1",
        orderNumber: "ORD-1234",
        status: "PENDING",
        totalAmount: 2500,
        paymentMethod: "COD",
        createdAt: new Date().toISOString(),
        customer: { fullName: "John Doe" },
    };

    const defaultProps = {
        order: mockOrder,
        onOpen: jest.fn(),
        onNextStatus: jest.fn(),
        onCancel: jest.fn(),
    };

    test("renders order number", () => {
        render(<OrderCard {...defaultProps} />);
        expect(screen.getByText("#ORD-1234")).toBeInTheDocument();
    });

    test("renders customer name", () => {
        render(<OrderCard {...defaultProps} />);
        expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    test("renders status text", () => {
        render(<OrderCard {...defaultProps} />);
        expect(screen.getByText("PENDING")).toBeInTheDocument();
    });

    test("renders payment method", () => {
        render(<OrderCard {...defaultProps} />);
        expect(screen.getByText("COD")).toBeInTheDocument();
    });
});
