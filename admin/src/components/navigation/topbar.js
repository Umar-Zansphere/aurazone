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
                    {/* Logo */}
                    <Link href="/" className="text-lg font-bold text-[var(--text-primary)]">
                        AuraZone
                    </Link>
                </div>

                <div className="flex items-center gap-1">
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
        </header>
    );
}
