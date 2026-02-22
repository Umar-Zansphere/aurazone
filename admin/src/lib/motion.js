export const spring = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

export const horizontalPageVariants = {
  initial: { x: 56, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: spring },
  exit: { x: -56, opacity: 0, transition: { duration: 0.2 } },
};

export const verticalPageVariants = {
  initial: { y: 56, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: spring },
  exit: { y: 24, opacity: 0, transition: { duration: 0.2 } },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const listItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24 } },
};
