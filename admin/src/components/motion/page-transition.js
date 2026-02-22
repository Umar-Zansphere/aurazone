"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { horizontalPageVariants, verticalPageVariants } from "@/lib/motion";

const isVerticalFlow = (pathname) => {
  return (
    /^\/orders\/[^/]+$/.test(pathname) ||
    /^\/products\/[^/]+$/.test(pathname) ||
    pathname === "/products/new"
  );
};

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const variants = isVerticalFlow(pathname) ? verticalPageVariants : horizontalPageVariants;

  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      className="min-h-dvh"
    >
      {children}
    </motion.div>
  );
}
