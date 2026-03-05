/**
 * Tests for src/components/BottomNav.jsx
 * Uses icons: Home, ShoppingBag, Heart, User, Search from lucide-react
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

// Mock lucide-react with the exact icons BottomNav uses
jest.mock('lucide-react', () => ({
    Home: (props) => <span data-testid="icon-home" {...props} />,
    Search: (props) => <span data-testid="icon-search" {...props} />,
    ShoppingBag: (props) => <span data-testid="icon-cart" {...props} />,
    Heart: (props) => <span data-testid="icon-heart" {...props} />,
    User: (props) => <span data-testid="icon-user" {...props} />,
}));

import BottomNav from '@/components/BottomNav';

beforeEach(() => {
    usePathname.mockReturnValue('/');
});

describe('BottomNav', () => {
    test('renders 5 navigation items', () => {
        render(<BottomNav />);
        const links = screen.getAllByRole('link');
        expect(links.length).toBe(5);
    });

    test('renders Home link', () => {
        render(<BottomNav />);
        expect(screen.getByText('Home')).toBeInTheDocument();
    });

    test('renders Explore link', () => {
        render(<BottomNav />);
        expect(screen.getByText('Explore')).toBeInTheDocument();
    });

    test('renders Cart link', () => {
        render(<BottomNav />);
        expect(screen.getByText('Cart')).toBeInTheDocument();
    });

    test('renders Wishlist link', () => {
        render(<BottomNav />);
        expect(screen.getByText('Wishlist')).toBeInTheDocument();
    });

    test('renders Profile link', () => {
        render(<BottomNav />);
        expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    test('hides on /login route', () => {
        usePathname.mockReturnValue('/login');
        const { container } = render(<BottomNav />);
        expect(container.firstChild).toBeNull();
    });

    test('hides on /signup route', () => {
        usePathname.mockReturnValue('/signup');
        const { container } = render(<BottomNav />);
        expect(container.firstChild).toBeNull();
    });

    test('hides on /verify-otp route', () => {
        usePathname.mockReturnValue('/verify-otp');
        const { container } = render(<BottomNav />);
        expect(container.firstChild).toBeNull();
    });

    test('hides on /forgot-password route', () => {
        usePathname.mockReturnValue('/forgot-password');
        const { container } = render(<BottomNav />);
        expect(container.firstChild).toBeNull();
    });
});
