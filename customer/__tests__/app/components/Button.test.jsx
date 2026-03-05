/**
 * Tests for src/app/components/ui/Button.jsx
 * The component signature: Button({ children, variant = 'primary', isLoading, className = '', ...props })
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/app/components/ui/Button';

describe('Button', () => {
    test('renders children text', () => {
        render(<Button>Click Me</Button>);
        expect(screen.getByRole('button').textContent).toBe('Click Me');
    });

    test('renders with primary variant by default', () => {
        render(<Button>Primary</Button>);
        const button = screen.getByRole('button');
        expect(button).toBeTruthy();
        expect(button.className).toContain('bg-black');
    });

    test('renders with accent variant', () => {
        render(<Button variant="accent">Accent</Button>);
        const button = screen.getByRole('button');
        expect(button.textContent).toBe('Accent');
    });

    test('renders with secondary variant', () => {
        render(<Button variant="secondary">Secondary</Button>);
        expect(screen.getByRole('button').textContent).toBe('Secondary');
    });

    test('renders with outline variant', () => {
        render(<Button variant="outline">Outline</Button>);
        expect(screen.getByRole('button').textContent).toBe('Outline');
    });

    test('renders with ghost variant', () => {
        render(<Button variant="ghost">Ghost</Button>);
        expect(screen.getByRole('button').textContent).toBe('Ghost');
    });

    test('shows loading spinner when isLoading=true', () => {
        render(<Button isLoading>Loading</Button>);
        const button = screen.getByRole('button');
        // When loading, children are replaced by a spinner div
        expect(button.textContent).not.toBe('Loading');
        expect(button.querySelector('.animate-spin')).toBeTruthy();
    });

    test('is disabled when isLoading', () => {
        render(<Button isLoading>Submit</Button>);
        expect(screen.getByRole('button').disabled).toBe(true);
    });

    test('handles onClick', () => {
        const onClick = jest.fn();
        render(<Button onClick={onClick}>Click</Button>);
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('passes additional props', () => {
        render(<Button type="submit" data-testid="btn">Submit</Button>);
        const button = screen.getByTestId('btn');
        expect(button.getAttribute('type')).toBe('submit');
    });

    test('applies custom className', () => {
        render(<Button className="custom-class">Custom</Button>);
        const button = screen.getByRole('button');
        expect(button.className).toContain('custom-class');
    });

    test('is not disabled when isLoading is false', () => {
        render(<Button>Active</Button>);
        expect(screen.getByRole('button').disabled).toBe(false);
    });
});
