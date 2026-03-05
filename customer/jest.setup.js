require('@testing-library/jest-dom');

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(() => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        refresh: jest.fn(),
        prefetch: jest.fn(),
    })),
    usePathname: jest.fn(() => '/'),
    useSearchParams: jest.fn(() => ({
        get: jest.fn(() => null),
    })),
    useParams: jest.fn(() => ({})),
}));

// Mock next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: function MockImage(props) {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return require('react').createElement('img', { ...props, fill: undefined });
    },
}));

// Mock next/link
jest.mock('next/link', () => ({
    __esModule: true,
    default: function MockLink({ children, href, ...props }) {
        return require('react').createElement('a', { href, ...props }, children);
    },
}));

// Mock next/server
jest.mock('next/server', () => ({
    NextResponse: {
        next: jest.fn(() => ({ type: 'next' })),
        redirect: jest.fn((url) => ({ type: 'redirect', url: url.toString() })),
    },
}));

// Suppress console.error and console.log in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
    console.error = jest.fn();
    console.log = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
});
