/**
 * Tests for src/components/Toast.jsx
 * Toast is a wrapper that reads from ToastContext via useToast()
 * It renders a list of ToastItem components from context's toasts array
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/ToastContext';
import Toast from '@/components/Toast';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
    CheckCircle: (props) => <span data-testid="icon-check" {...props} />,
    XCircle: (props) => <span data-testid="icon-x-circle" {...props} />,
    AlertCircle: (props) => <span data-testid="icon-alert" {...props} />,
    Info: (props) => <span data-testid="icon-info" {...props} />,
    X: (props) => <span data-testid="icon-x" {...props} />,
}));

// Helper that renders Toast inside a provider and triggers a toast
function ToastWithTrigger({ type = 'success', message = 'Test message' }) {
    const { showToast } = useToast();
    return (
        <div>
            <button data-testid="trigger" onClick={() => showToast(message, type)}>Trigger</button>
            <Toast />
        </div>
    );
}

function renderWithProvider(type, message) {
    const utils = render(
        <ToastProvider>
            <ToastWithTrigger type={type} message={message} />
        </ToastProvider>
    );
    // Trigger a toast
    act(() => {
        screen.getByTestId('trigger').click();
    });
    return utils;
}

describe('Toast', () => {
    test('renders toast message', () => {
        renderWithProvider('success', 'Test message');
        expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    test('renders success icon for success type', () => {
        renderWithProvider('success', 'Success!');
        expect(screen.getByTestId('icon-check')).toBeInTheDocument();
    });

    test('renders error icon for error type', () => {
        renderWithProvider('error', 'Error!');
        expect(screen.getByTestId('icon-x-circle')).toBeInTheDocument();
    });

    test('renders warning icon for warning type', () => {
        renderWithProvider('warning', 'Warning!');
        expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
    });

    test('renders info icon for info type', () => {
        renderWithProvider('info', 'Info!');
        expect(screen.getByTestId('icon-info')).toBeInTheDocument();
    });

    test('close button is rendered', () => {
        renderWithProvider('success', 'Close me');
        const closeButton = screen.getByLabelText('Close notification');
        expect(closeButton).toBeInTheDocument();
    });

    test('has correct accessibility role', () => {
        renderWithProvider('success', 'Accessible');
        const alertElement = screen.getByRole('alert');
        expect(alertElement).toBeInTheDocument();
    });

    test('renders custom message content', () => {
        renderWithProvider('success', 'Custom toast content');
        expect(screen.getByText('Custom toast content')).toBeInTheDocument();
    });
});
