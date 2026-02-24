'use client';

import { useRouter } from 'next/navigation';
import { ShoppingBag, LogIn, UserPlus, Heart, Package } from 'lucide-react';

export default function LoginPrompt({
    title = "Login Required",
    message = "Please log in to access this feature",
    showGuestOption = true
}) {
    const router = useRouter();

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full">
                {/* Icon */}
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
                    <LogIn className="w-10 h-10 text-white" />
                </div>

                {/* Title */}
                <h2 className="text-3xl font-bold text-center text-slate-900 mb-3">
                    {title}
                </h2>

                {/* Message */}
                <p className="text-center text-slate-600 mb-8">
                    {message}
                </p>

                {/* Login Button */}
                <button
                    onClick={() => router.push(`/login?redirect=${window.location.pathname}`)}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 mb-4"
                >
                    <LogIn className="w-5 h-5" />
                    Log In to Continue
                </button>

                {/* Signup Button */}
                <button
                    onClick={() => router.push('/signup')}
                    className="w-full bg-white hover:bg-slate-50 text-slate-900 py-4 px-6 rounded-2xl font-bold transition-all border-2 border-slate-200 hover:border-slate-300 flex items-center justify-center gap-3 mb-6"
                >
                    <UserPlus className="w-5 h-5" />
                    Create New Account
                </button>

                {/* Guest Options */}
                {showGuestOption && (
                    <>
                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-slate-50 text-slate-500 font-medium">
                                    Or continue as guest
                                </span>
                            </div>
                        </div>

                        {/* Guest Actions */}
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => router.push('/')}
                                className="flex flex-col items-center gap-2 p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-orange-300 transition-all group"
                            >
                                <ShoppingBag className="w-6 h-6 text-slate-600 group-hover:text-orange-600 transition-colors" />
                                <span className="text-xs font-medium text-slate-700">Shop</span>
                            </button>

                            <button
                                onClick={() => router.push('/cart')}
                                className="flex flex-col items-center gap-2 p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-orange-300 transition-all group"
                            >
                                <ShoppingBag className="w-6 h-6 text-slate-600 group-hover:text-orange-600 transition-colors" />
                                <span className="text-xs font-medium text-slate-700">Cart</span>
                            </button>

                            <button
                                onClick={() => router.push('/track-order')}
                                className="flex flex-col items-center gap-2 p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-orange-300 transition-all group"
                            >
                                <Package className="w-6 h-6 text-slate-600 group-hover:text-orange-600 transition-colors" />
                                <span className="text-xs font-medium text-slate-700">Track</span>
                            </button>
                        </div>
                    </>
                )}

                {/* Info Text */}
                <p className="text-center text-sm text-slate-500 mt-8">
                    🔒 Your data is secure and protected
                </p>
            </div>
        </div>
    );
}
