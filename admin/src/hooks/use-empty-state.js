"use client";

import { useMemo } from "react";

/**
 * A hook to determine the current state of a data fetch operation.
 * @param {boolean} isLoading - Whether the data is currently loading.
 * @param {Array|Object|null} data - The fetched data.
 * @param {Error|null} error - Any fetch error.
 * @returns {Object} An object containing boolean flags for the current state.
 */
export function useEmptyState(isLoading, data, error) {
    return useMemo(() => {
        const isError = !!error;
        const isDataArray = Array.isArray(data);

        // Determine if data is explicitly "empty"
        // Considerations: null/undefined, empty array, or empty object
        let isEmpty = false;
        if (!data) {
            isEmpty = true; // null or undefined
        } else if (isDataArray && data.length === 0) {
            isEmpty = true;
        } else if (!isDataArray && typeof data === "object" && Object.keys(data).length === 0) {
            isEmpty = true;
        }

        const showLoading = isLoading && !data;
        const showEmpty = !isLoading && !isError && isEmpty;
        const showContent = !isLoading && !isError && !isEmpty;

        return {
            isError,
            isEmpty,
            isLoading: showLoading,
            showEmpty,
            showContent,
            showError: isError && !isLoading, // Prefer showing error over loading if both are somehow true
        };
    }, [isLoading, data, error]);
}
