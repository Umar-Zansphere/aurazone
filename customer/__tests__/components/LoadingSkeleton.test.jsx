/**
 * Tests for src/components/LoadingSkeleton.jsx
 * 6 skeleton variants for different page sections
 */
import React from 'react';
import { render } from '@testing-library/react';
import {
    LoadingSkeleton,
    CartLoadingSkeleton,
    ProductDetailSkeleton,
    WishlistLoadingSkeleton,
    OrdersLoadingSkeleton,
    OrderDetailSkeleton,
} from '@/components/LoadingSkeleton';

describe('LoadingSkeleton variants', () => {
    test('LoadingSkeleton renders without error', () => {
        const { container } = render(<LoadingSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    test('CartLoadingSkeleton renders without error', () => {
        const { container } = render(<CartLoadingSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    test('ProductDetailSkeleton renders without error', () => {
        const { container } = render(<ProductDetailSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    test('WishlistLoadingSkeleton renders without error', () => {
        const { container } = render(<WishlistLoadingSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    test('OrdersLoadingSkeleton renders without error', () => {
        const { container } = render(<OrdersLoadingSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    test('OrderDetailSkeleton renders without error', () => {
        const { container } = render(<OrderDetailSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    test('LoadingSkeleton has animated pulse elements', () => {
        const { container } = render(<LoadingSkeleton />);
        const pulseElements = container.querySelectorAll('[class*="animate-pulse"]');
        expect(pulseElements.length).toBeGreaterThan(0);
    });

    test('CartLoadingSkeleton has animated pulse elements', () => {
        const { container } = render(<CartLoadingSkeleton />);
        const pulseElements = container.querySelectorAll('[class*="animate-pulse"]');
        expect(pulseElements.length).toBeGreaterThan(0);
    });
});
