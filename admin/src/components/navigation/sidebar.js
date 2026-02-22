"use client";

import { House, ShoppingBag, Plus, Package, User, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard, match: (path) => path === "/" },
    { label: "Orders", href: "/orders", icon: ShoppingBag, match: (path) => path.startsWith("/orders") },
    { label: "Products", href: "/products", icon: Package, match: (path) => path.startsWith("/products") },
];

const bottomItems = [
    { label: "Settings", href: "/settings", icon: Settings, match: (path) => path.startsWith("/settings") },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 md:flex">
            <div className="mb-8 flex items-center px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--highlight)] text-white shadow-sm">
                    <House size={20} />
                </div>
                <span className="ml-3 text-lg font-bold tracking-tight text-[var(--accent)]">AuraZone</span>
            </div>

            <div className="mb-6 px-2">
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90">
                    <Plus size={18} />
                    Create New
                </button>
            </div>

            <nav className="flex-1 space-y-1">
                {navItems.map((item) => {
                    const active = item.match(pathname);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active
                                    ? "bg-[var(--accent)] text-white shadow-sm"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
                                }`}
                        >
                            <Icon size={18} className={active ? "text-white" : "text-[var(--text-muted)]"} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto space-y-1 pt-4 border-t border-[var(--border)]">
                {bottomItems.map((item) => {
                    const active = item.match(pathname);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active
                                    ? "bg-[var(--accent)] text-white shadow-sm"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
                                }`}
                        >
                            <Icon size={18} className={active ? "text-white" : "text-[var(--text-muted)]"} />
                            {item.label}
                        </Link>
                    );
                })}

                {/* User Profile Mini */}
                <div className="mt-4 flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--bg-app)] cursor-pointer transition-colors">
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-[var(--border)] flex items-center justify-center">
                        <User size={18} className="text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">Admin User</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">admin@aurazone.com</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
