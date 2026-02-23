"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Search, Menu, X } from "lucide-react";
import Link from "next/link";
import { useRef, useEffect } from "react";
import { useSidebarStore } from "@/stores/use-sidebar-store";

export default function Topbar() {
    const toggleSidebar = useSidebarStore((s) => s.toggle);
    const searchOpen = useSidebarStore((s) => s.searchOpen);
    const toggleSearch = useSidebarStore((s) => s.toggleSearch);
    const closeSearch = useSidebarStore((s) => s.closeSearch);
    const searchRef = useRef(null);

    // Auto-focus the mobile search input when it opens
    useEffect(() => {
        if (searchOpen && searchRef.current) {
            searchRef.current.focus();
        }
    }, [searchOpen]);

    return (
        <header className="sticky top-0 z-30 w-full border-b border-[var(--border)] bg-white/90 backdrop-blur-md">
            {/* Main bar */}
            <div className="flex h-[60px] items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-3">
                    {/* Hamburger — mobile only */}
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] md:hidden"
                        aria-label="Toggle menu"
                    >
                        <Menu size={18} />
                    </button>

                    {/* Desktop search */}
                    <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-4 py-2 text-sm text-[var(--text-muted)] transition-all focus-within:border-[var(--highlight)] focus-within:ring-2 focus-within:ring-[var(--highlight-soft)] md:flex w-64 lg:w-80">
                        <Search size={15} />
                        <input
                            type="text"
                            placeholder="Search orders, products..."
                            className="w-full bg-transparent outline-none placeholder:text-[var(--text-muted)] text-[var(--text-primary)] text-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Mobile search toggle */}
                    <button
                        type="button"
                        onClick={toggleSearch}
                        className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)] md:hidden"
                        aria-label="Toggle search"
                    >
                        {searchOpen ? <X size={18} /> : <Search size={18} />}
                    </button>

                    {/* Notifications */}
                    <Link
                        href="/notifications"
                        className="relative grid h-9 w-9 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
                    >
                        <Bell size={18} />
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--highlight)] outline outline-2 outline-white" />
                    </Link>
                </div>
            </div>

            {/* Mobile search bar — slides down */}
            <AnimatePresence>
                {searchOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-[var(--border)] md:hidden"
                    >
                        <div className="flex items-center gap-2 px-4 py-2.5">
                            <Search size={15} className="shrink-0 text-[var(--text-muted)]" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search orders, products..."
                                onBlur={() => {
                                    // Delay close to allow tap on results
                                    setTimeout(closeSearch, 150);
                                }}
                                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
                            />
                            <button
                                type="button"
                                onClick={closeSearch}
                                className="shrink-0 text-xs font-medium text-[var(--highlight)]"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
