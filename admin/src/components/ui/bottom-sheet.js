"use client";

import { AnimatePresence, motion } from "framer-motion";

const snapMap = {
  half: "50dvh",
  full: "90dvh",
};

export default function BottomSheet({
  open,
  onClose,
  children,
  title,
  snap = "full",
}) {
  const maxHeight = snapMap[snap] || snapMap.full;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[3px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close"
          />
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y > 70 || info.velocity.y > 800) {
                onClose();
              }
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] rounded-t-[28px] border border-[var(--card-border)] bg-white px-4 pb-8 pt-2 shadow-2xl"
            style={{ maxHeight }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300" />
            {title ? <h2 className="px-1 pb-3 text-base font-semibold">{title}</h2> : null}
            <div className="hide-scrollbar overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 56px)` }}>
              {children}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
