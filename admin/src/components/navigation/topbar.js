"use client";

import { Bell, Search, Menu } from "lucide-react";

export default function Topbar() {
    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--card-border)] bg-white/80 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-4">
                {/* Mobile Menu Toggle (optional visual) */}
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-app)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] md:hidden">
                    <Menu size={20} />
                </button>

                {/* Desktop Search */}
                <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-app)] px-4 py-2 text-sm text-[var(--text-muted)] focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] md:flex w-64 lg:w-96">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search orders, products..."
                        className="w-full bg-transparent outline-none placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Mobile Search Icon */}
                <button className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)] md:hidden">
                    <Search size={20} />
                </button>

                {/* Notifications */}
                <button className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]">
                    <Bell size={20} />
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--highlight)] outline outline-2 outline-white"></span>
                </button>
            </div>
        </header>
    );
}
