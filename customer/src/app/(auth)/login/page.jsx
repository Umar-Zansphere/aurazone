'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, Mail, Lock, ArrowRight } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { authApi } from '@/lib/api';
import PublicRoute from '@/components/PublicRoute';

function LoginContent() {
  const router = useRouter();
  const [method, setMethod] = useState('phone'); // 'phone' | 'email'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (method === 'phone') {
        const res = await authApi.phoneLogin(formData.phone);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to send code');

        // Redirect to OTP verification
        router.push(`/verify-otp?phone=${encodeURIComponent(formData.phone)}&mode=login`);
      } else {
        const res = await authApi.login(formData.email, formData.password);
        const data = await res.json();
        console.log(data);

        if (!res.ok) throw new Error(data.message || 'Login failed');

        // Authentication state is now managed via cookies set by the backend
        console.log("User Role after login:", data.user.userRole);

        if (data.user.userRole === 'ADMIN') {
          router.push('/admin'); // Go to admin dashboard
        } else {
          router.push('/'); // Go to home
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--background) flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Illustration */}
        <div className="flex justify-center mb-4">
          <LoginIllustration />
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-(--text-primary)">Welcome Back!</h1>
          <p className="text-(--text-secondary)">Please enter your details to sign in.</p>
        </div>

        {/* Toggle */}
        <div className="flex bg-(--img-bg) p-1.5 rounded-full relative">
          <button
            onClick={() => setMethod('phone')}
            className={`flex-1 py-3 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${method === 'phone'
              ? 'bg-white shadow-md text-(--text-primary)'
              : 'text-(--text-secondary) hover:text-(--text-primary)'
              }`}
          >
            Phone Number
          </button>
          <button
            onClick={() => setMethod('email')}
            className={`flex-1 py-3 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${method === 'email'
              ? 'bg-white shadow-md text-(--text-primary)'
              : 'text-(--text-secondary) hover:text-(--text-primary)'
              }`}
          >
            Email & Password
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {method === 'phone' ? (
            <Input
              icon={Smartphone}
              placeholder="+1 555 000 0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              type="tel"
              required
            />
          ) : (
            <div className="space-y-5">
              <Input
                icon={Mail}
                placeholder="hello@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                type="email"
                required
              />
              <div className="space-y-2">
                <Input
                  icon={Lock}
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-sm font-semibold text-(--text-primary) hover:text-(--accent) transition-colors duration-300 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-(--accent) text-sm rounded-2xl text-center font-medium">
              {error}
            </div>
          )}

          <Button type="submit" isLoading={loading} variant={method === 'phone' ? 'accent' : 'primary'}>
            {method === 'phone' ? 'Get Verification Code' : 'Sign In'}
            {!loading && <ArrowRight size={18} />}
          </Button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center pt-4">
          <p className="text-(--text-secondary) text-sm">
            Don't have an account?{' '}
            <button
              onClick={() => router.push('/signup')}
              className="text-(--accent) font-bold hover:underline transition-colors duration-300"
            >
              Register Now
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PublicRoute>
      <LoginContent />
    </PublicRoute>
  );
}

const LoginIllustration = () => (
  <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-bounce" style={{ animationDuration: '3s' }}>
    {/* Background circle */}
    <circle cx="100" cy="90" r="85" fill="#F3F4F6" opacity="0.5" />

    {/* Shoe illustration */}
    <g transform="translate(50, 60)">
      {/* Shoe sole */}
      <ellipse cx="50" cy="65" rx="45" ry="12" fill="#1F2937" opacity="0.1" />

      {/* Shoe main body */}
      <path d="M 20 50 Q 15 45 25 35 Q 35 30 50 28 Q 65 30 75 35 Q 85 45 80 50 L 75 60 Q 70 65 50 68 Q 30 65 25 60 Z" fill="#FF6B6B" />

      {/* Shoe highlight */}
      <path d="M 25 40 Q 30 35 40 33 Q 45 32 50 32" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.6" />

      {/* Laces */}
      <line x1="40" y1="45" x2="40" y2="58" stroke="#1F2937" strokeWidth="1.5" opacity="0.5" />
      <line x1="50" y1="45" x2="50" y2="58" stroke="#1F2937" strokeWidth="1.5" opacity="0.5" />
      <line x1="60" y1="45" x2="60" y2="58" stroke="#1F2937" strokeWidth="1.5" opacity="0.5" />
    </g>

    {/* Decorative elements */}
    <circle cx="30" cy="30" r="3" fill="#FF6B6B" opacity="0.4" />
    <circle cx="170" cy="40" r="2" fill="#FF6B6B" opacity="0.3" />
    <circle cx="160" cy="150" r="2.5" fill="#1F2937" opacity="0.2" />
  </svg>
);
