"use client";

import { FolderTree } from "lucide-react";
import { motion } from "framer-motion";

export default function EmptyState({
    title = "No data available",
    description = "There is nothing to show here at the moment.",
    icon: Icon = FolderTree,
    action,
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-sm"
        >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-app)] text-[var(--accent)]">
                <Icon size={32} strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="mb-6 max-w-sm text-sm text-[var(--text-secondary)]">{description}</p>

            {action && (
                <button
                    onClick={action.onClick}
                    className="app-button bg-[var(--highlight)] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
                >
                    {action.label}
                </button>
            )}
        </motion.div>
    );
}
