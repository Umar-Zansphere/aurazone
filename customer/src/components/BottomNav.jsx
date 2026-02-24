'use client'
import { Home, ShoppingBag, Heart, User, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
    const pathname = usePathname();

    // Hide BottomNav on auth pages, admin pages, and unauthorized page
    const hideOnRoutes = ['/login', '/signup', '/verify-otp', '/verify-email', '/forgot-password', '/admin', '/unauthorized'];
    const shouldHide = hideOnRoutes.some(route => pathname?.startsWith(route));

    if (shouldHide) {
        return null;
    }

    const navItems = [
        { href: '/', icon: Home, label: 'Home' },
        { href: '/explore', icon: Search, label: 'Explore' },
        { href: '/cart', icon: ShoppingBag, label: 'Cart' },
        { href: '/wishlist', icon: Heart, label: 'Wishlist' },
        { href: '/profile', icon: User, label: 'Profile' },
    ];

    const isActive = (href) => {
        if (href === '/') return pathname === '/';
        return pathname?.startsWith(href);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden safe-area-bottom">
            <div className="flex items-center justify-around h-16 px-2">
                {navItems.map(({ href, icon: Icon, label }) => {
                    const active = isActive(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-colors touch-manipulation ${active
                                ? 'text-[#172031]'
                                : 'text-gray-500 active:text-gray-700'
                                }`}
                        >
                            <div className="relative">
                                <Icon
                                    size={24}
                                    className={`transition-transform ${active ? 'scale-110' : ''}`}
                                    strokeWidth={active ? 2.5 : 2}
                                />
                                {active && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#172031] rounded-full" />
                                )}
                            </div>
                            <span className={`text-xs mt-1 font-medium ${active ? 'text-[#172031]' : 'text-gray-500'}`}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
