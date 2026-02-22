"use client";

import PageTransition from "@/components/motion/page-transition";

export default function AppTemplate({ children }) {
  return <PageTransition>{children}</PageTransition>;
}
