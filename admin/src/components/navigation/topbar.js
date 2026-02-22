"use client";

import { Bell, Search, Menu } from "lucide-react";
import Link from "next/link";

export default function Topbar() {
    return (
        <header className="sticky top-0 z-30 flex h-[60px] w-full items-center justify-between border-b border-[var(--border)] bg-white/90 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-4">
                <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-app)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] md:hidden">
                    <Menu size={18} />
                </button>

                <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-4 py-2 text-sm text-[var(--text-muted)] transition-all focus-within:border-[var(--highlight)] focus-within:ring-2 focus-within:ring-[var(--highlight-soft)] md:flex w-64 lg:w-80">
                    <Search size={15} />
                    <input
                        type="text"
                        placeholder="Search orders, products..."
                        className="w-full bg-transparent outline-none placeholder:text-[var(--text-muted)] text-[var(--text-primary)] text-sm"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)] md:hidden">
                    <Search size={18} />
                </button>

                <Link
                    href="/notifications"
                    className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
                >
                    <Bell size={18} />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--highlight)] outline outline-2 outline-white"></span>
                </Link>
            </div>
        </header>
    );
}
