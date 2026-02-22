"use client";

import { useEffect, useRef, useState } from "react";

export const useScrollDirection = () => {
  const [direction, setDirection] = useState("up");
  const [isTop, setIsTop] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const handle = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastY.current;

      if (Math.abs(delta) > 6) {
        setDirection(delta > 0 ? "down" : "up");
      }

      setIsTop(currentY < 24);
      lastY.current = currentY;
    };

    handle();
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  return {
    direction,
    isTop,
  };
};
