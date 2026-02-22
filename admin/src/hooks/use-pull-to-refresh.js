"use client";

import { useCallback, useRef, useState } from "react";

export const usePullToRefresh = (onRefresh, threshold = 72) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const active = useRef(false);

  const onTouchStart = useCallback((event) => {
    if (window.scrollY > 0 || refreshing) {
      return;
    }

    active.current = true;
    startY.current = event.touches[0].clientY;
  }, [refreshing]);

  const onTouchMove = useCallback((event) => {
    if (!active.current) {
      return;
    }

    const distance = Math.max(0, event.touches[0].clientY - startY.current);
    setPullDistance(Math.min(120, distance * 0.55));
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!active.current) {
      return;
    }

    active.current = false;

    if (pullDistance >= threshold && onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }

    setPullDistance(0);
  }, [onRefresh, pullDistance, threshold]);

  return {
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    pullDistance,
    refreshing,
  };
};
