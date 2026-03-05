/**
 * Tests for src/components/LoginPrompt.jsx
 * Props: title, message, showGuestOption
 * Icons used: ShoppingBag, LogIn, UserPlus, Heart, Package
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';

// Mock lucide-react with the exact icons LoginPrompt uses
jest.mock('lucide-react', () => ({
    LogIn: (props) => <span data-testid="icon-login" {...props} />,
    ShoppingBag: (props) => <span data-testid="icon-shopping" {...props} />,
    Heart: (props) => <span data-testid="icon-heart" {...props} />,
    UserPlus: (props) => <span data-testid="icon-user-plus" {...props} />,
    Package: (props) => <span data-testid="icon-package" {...props} />,
}));

import LoginPrompt from '@/components/LoginPrompt';

const mockPush = jest.fn();

beforeEach(() => {
    useRouter.mockReturnValue({ push: mockPush, replace: jest.fn(), back: jest.fn() });
    // Mock window.location
    delete window.location;
    window.location = { pathname: '/cart' };
    jest.clearAllMocks();
});

describe('LoginPrompt', () => {
    test('renders default title', () => {
        render(<LoginPrompt />);
        expect(screen.getByText('Login Required')).toBeInTheDocument();
    });

    test('renders custom title when provided', () => {
        render(<LoginPrompt title="Custom Title" />);
        expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    test('renders default message', () => {
        render(<LoginPrompt />);
        expect(screen.getByText('Please log in to access this feature')).toBeInTheDocument();
    });

    test('renders custom message when provided', () => {
        render(<LoginPrompt message="Custom message here" />);
        expect(screen.getByText('Custom message here')).toBeInTheDocument();
    });

    test('renders Log In button', () => {
        render(<LoginPrompt />);
        expect(screen.getByText(/Log In to Continue/)).toBeInTheDocument();
    });

    test('renders Create New Account button', () => {
        render(<LoginPrompt />);
        expect(screen.getByText(/Create New Account/)).toBeInTheDocument();
    });

    test('shows guest options by default (showGuestOption=true)', () => {
        render(<LoginPrompt />);
        expect(screen.getByText(/continue as guest/i)).toBeInTheDocument();
    });

    test('hides guest options when showGuestOption=false', () => {
        render(<LoginPrompt showGuestOption={false} />);
        expect(screen.queryByText(/continue as guest/i)).not.toBeInTheDocument();
    });
});
