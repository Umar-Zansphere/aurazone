/**
 * Tests for src/app/components/ui/Input.jsx
 * Component signature: Input({ label, icon: Icon, type = 'text', error, ...props })
 * icon is a component reference (Icon), used as <Icon size={20} />
 * Password toggle: initially shows Eye, toggles to EyeOff
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Input from '@/app/components/ui/Input';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
    Eye: (props) => <span data-testid="icon-eye" {...props} />,
    EyeOff: (props) => <span data-testid="icon-eye-off" {...props} />,
}));

describe('Input', () => {
    test('renders with label', () => {
        render(<Input label="Email" />);
        expect(screen.getByText('Email')).toBeInTheDocument();
    });

    test('renders with placeholder', () => {
        render(<Input placeholder="Enter email" />);
        expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    test('renders with icon component', () => {
        // icon prop is a *component reference*, not JSX
        const MockIcon = (props) => <span data-testid="custom-icon" {...props} />;
        render(<Input icon={MockIcon} />);
        expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    test('renders without icon', () => {
        const { container } = render(<Input placeholder="No icon" />);
        expect(container.querySelector('[data-testid="custom-icon"]')).toBeNull();
    });

    test('password type shows Eye icon initially (not showing password)', () => {
        render(<Input type="password" />);
        // When showPassword=false, it shows Eye icon
        expect(screen.getByTestId('icon-eye')).toBeInTheDocument();
    });

    test('password toggle switches to EyeOff when clicked', () => {
        render(<Input type="password" placeholder="Password" />);
        // Click the toggle button (which wraps Eye icon)
        const toggleButton = screen.getByTestId('icon-eye').closest('button');
        fireEvent.click(toggleButton);
        // After toggling, EyeOff should show
        expect(screen.getByTestId('icon-eye-off')).toBeInTheDocument();
    });

    test('password toggle changes input type to text', () => {
        render(<Input type="password" placeholder="Password" />);
        const input = screen.getByPlaceholderText('Password');
        expect(input.type).toBe('password');
        // Click toggle
        fireEvent.click(screen.getByTestId('icon-eye').closest('button'));
        expect(input.type).toBe('text');
    });

    test('shows error message when error prop is provided', () => {
        render(<Input error="This field is required" />);
        expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    test('does not show error when error prop is empty', () => {
        render(<Input error="" placeholder="No error" />);
        expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    });

    test('passes extra props to input element', () => {
        render(<Input data-testid="input" name="email" />);
        const input = screen.getByTestId('input');
        expect(input.getAttribute('name')).toBe('email');
    });

    test('renders with correct email input type', () => {
        render(<Input type="email" placeholder="Email" />);
        const input = screen.getByPlaceholderText('Email');
        expect(input.type).toBe('email');
    });

    test('handles onChange events', () => {
        const onChange = jest.fn();
        render(<Input onChange={onChange} placeholder="Type here" />);
        fireEvent.change(screen.getByPlaceholderText('Type here'), { target: { value: 'hello' } });
        expect(onChange).toHaveBeenCalled();
    });

    test('renders without crashing with no props', () => {
        const { container } = render(<Input />);
        expect(container.firstChild).toBeTruthy();
    });
});
