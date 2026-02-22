"use client";

import { FolderTree } from "lucide-react";
import { motion } from "framer-motion";

export default function EmptyState({
    title = "No data available",
    description = "There is nothing to show here at the moment.",
    icon: Icon = FolderTree,
    action,
    variant = "default",
}) {
    const isError = variant === "error";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex flex-col items-center justify-center rounded-[20px] border border-dashed p-10 text-center ${isError
                    ? "border-[color:rgba(155,44,44,0.2)] bg-[color:rgba(155,44,44,0.02)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)]"
                }`}
        >
            <div
                className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isError
                        ? "bg-[color:rgba(155,44,44,0.08)] text-[var(--error)]"
                        : "bg-[var(--highlight-soft)] text-[var(--highlight)]"
                    }`}
            >
                <Icon size={28} strokeWidth={1.5} />
            </div>
            <h3 className={`mb-1.5 text-base font-semibold ${isError ? "text-[var(--error)]" : "text-[var(--text-primary)]"}`}>
                {title}
            </h3>
            <p className="mb-5 max-w-xs text-sm leading-relaxed text-[var(--text-secondary)]">
                {description}
            </p>

            {action && (
                <button
                    onClick={action.onClick}
                    className="app-button app-button-primary px-5 py-2.5 text-sm"
                >
                    {action.label}
                </button>
            )}
        </motion.div>
    );
}
