const nextJest = require('next/jest');

/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|webp|svg|ico)$': '<rootDir>/__mocks__/fileMock.js',
    },
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', {
            jsc: {
                parser: {
                    syntax: 'ecmascript',
                    jsx: true,
                },
                transform: {
                    react: {
                        runtime: 'automatic',
                    },
                },
            },
        }],
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(lucide-react|zustand)/)',
    ],
    testMatch: [
        '<rootDir>/__tests__/**/*.test.{js,jsx}',
    ],
    collectCoverageFrom: [
        'src/**/*.{js,jsx}',
        '!src/app/globals.css',
        '!src/app/**/layout.jsx',
    ],
};

module.exports = config;
