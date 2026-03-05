/**
 * Tests for src/components/ToastContext.jsx
 * Toast notification system context provider
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/ToastContext';
import Toast from '@/components/Toast';

// Mock lucide-react
jest.mock('lucide-react', () => ({
    CheckCircle: (props) => <span data-testid="icon-check" {...props} />,
    XCircle: (props) => <span data-testid="icon-x-circle" {...props} />,
    AlertCircle: (props) => <span data-testid="icon-alert" {...props} />,
    Info: (props) => <span data-testid="icon-info" {...props} />,
    X: (props) => <span data-testid="icon-x" {...props} />,
}));

// Consumer component for testing
function TestConsumer() {
    const { showToast, clearAllToasts } = useToast();
    return (
        <div>
            <button onClick={() => showToast('Test toast', 'success')} data-testid="show-toast">Show Toast</button>
            <button onClick={() => showToast('Error toast', 'error')} data-testid="show-error">Show Error</button>
            <button onClick={() => showToast('Warning toast', 'warning')} data-testid="show-warning">Show Warning</button>
            <button onClick={() => showToast('Info toast', 'info')} data-testid="show-info">Show Info</button>
            <button onClick={() => clearAllToasts()} data-testid="clear-all">Clear All</button>
            <Toast />
        </div>
    );
}

describe('ToastContext', () => {
    test('renders provider and children', () => {
        render(
            <ToastProvider>
                <div data-testid="child">Hello</div>
            </ToastProvider>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    test('showToast adds a toast notification', () => {
        render(
            <ToastProvider>
                <TestConsumer />
            </ToastProvider>
        );
        act(() => {
            screen.getByTestId('show-toast').click();
        });
        expect(screen.getByText('Test toast')).toBeInTheDocument();
    });

    test('showToast with error type works', () => {
        render(
            <ToastProvider>
                <TestConsumer />
            </ToastProvider>
        );
        act(() => {
            screen.getByTestId('show-error').click();
        });
        expect(screen.getByText('Error toast')).toBeInTheDocument();
    });

    test('showToast with warning type works', () => {
        render(
            <ToastProvider>
                <TestConsumer />
            </ToastProvider>
        );
        act(() => {
            screen.getByTestId('show-warning').click();
        });
        expect(screen.getByText('Warning toast')).toBeInTheDocument();
    });

    test('showToast with info type works', () => {
        render(
            <ToastProvider>
                <TestConsumer />
            </ToastProvider>
        );
        act(() => {
            screen.getByTestId('show-info').click();
        });
        expect(screen.getByText('Info toast')).toBeInTheDocument();
    });

    test('clearAllToasts removes all toasts', () => {
        render(
            <ToastProvider>
                <TestConsumer />
            </ToastProvider>
        );
        // Add toasts
        act(() => {
            screen.getByTestId('show-toast').click();
            screen.getByTestId('show-error').click();
        });
        // Clear all
        act(() => {
            screen.getByTestId('clear-all').click();
        });
        expect(screen.queryByText('Test toast')).not.toBeInTheDocument();
        expect(screen.queryByText('Error toast')).not.toBeInTheDocument();
    });

    test('multiple showToast calls display multiple toasts', () => {
        render(
            <ToastProvider>
                <TestConsumer />
            </ToastProvider>
        );
        act(() => {
            screen.getByTestId('show-toast').click();
            screen.getByTestId('show-error').click();
        });
        expect(screen.getByText('Test toast')).toBeInTheDocument();
        expect(screen.getByText('Error toast')).toBeInTheDocument();
    });

    test('useToast throws error outside provider', () => {
        function BadConsumer() {
            useToast();
            return null;
        }

        expect(() => render(<BadConsumer />)).toThrow();
    });

    test('auto-dismiss works after duration', () => {
        jest.useFakeTimers();

        render(
            <ToastProvider>
                <TestConsumer />
            </ToastProvider>
        );

        act(() => {
            screen.getByTestId('show-toast').click();
        });
        expect(screen.getByText('Test toast')).toBeInTheDocument();

        // Advance timers past the toast duration
        act(() => {
            jest.advanceTimersByTime(5000);
        });

        // Toast should be removed after auto-dismiss
        expect(screen.queryByText('Test toast')).not.toBeInTheDocument();

        jest.useRealTimers();
    });

    test('provider renders without children', () => {
        const { container } = render(<ToastProvider />);
        expect(container).toBeTruthy();
    });
});
