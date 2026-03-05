module.exports = {
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/__tests__/setup.js"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    transform: {
        "^.+\\.[jt]sx?$": "babel-jest",
    },
    testMatch: ["<rootDir>/__tests__/**/*.test.js"],
    transformIgnorePatterns: [
        "/node_modules/(?!(zustand|jose|framer-motion|lucide-react|recharts)/)",
    ],
};
