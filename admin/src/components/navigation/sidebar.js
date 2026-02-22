"use client";

import { House, ShoppingBag, Plus, Package, User, LayoutDashboard, Settings, BarChart3, Bell, Boxes } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard, match: (path) => path === "/" },
    { label: "Orders", href: "/orders", icon: ShoppingBag, match: (path) => path.startsWith("/orders") },
    { label: "Products", href: "/products", icon: Package, match: (path) => path.startsWith("/products") },
    { label: "Inventory", href: "/inventory", icon: Boxes, match: (path) => path.startsWith("/inventory") },
    { label: "Analytics", href: "/analytics", icon: BarChart3, match: (path) => path.startsWith("/analytics") },
    { label: "Notifications", href: "/notifications", icon: Bell, match: (path) => path.startsWith("/notifications") },
];

const bottomItems = [
    { label: "Settings", href: "/settings", icon: Settings, match: (path) => path.startsWith("/settings") },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 md:flex">
            <div className="mb-8 flex items-center px-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                    <House size={18} />
                </div>
                <span className="ml-3 text-lg font-bold tracking-tight text-[var(--text-primary)]">AuraZone</span>
            </div>

            <div className="mb-6 px-2">
                <Link
                    href="/products/new"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-soft)] hover:shadow-sm"
                >
                    <Plus size={16} />
                    Create New
                </Link>
            </div>

            <nav className="flex-1 space-y-0.5">
                {navItems.map((item) => {
                    const active = item.match(pathname);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active
                                ? "bg-[var(--highlight-soft)] text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                                }`}
                        >
                            <Icon size={18} className={active ? "text-[var(--highlight)]" : "text-[var(--text-muted)]"} />
                            {item.label}
                            {active && (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--highlight)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto space-y-0.5 border-t border-[var(--border)] pt-4">
                {bottomItems.map((item) => {
                    const active = item.match(pathname);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${active
                                ? "bg-[var(--highlight-soft)] text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                                }`}
                        >
                            <Icon size={18} className={active ? "text-[var(--highlight)]" : "text-[var(--text-muted)]"} />
                            {item.label}
                        </Link>
                    );
                })}

                <div className="mt-4 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--surface-hover)] cursor-pointer">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--highlight-soft)]">
                        <User size={16} className="text-[var(--highlight)]" />
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
