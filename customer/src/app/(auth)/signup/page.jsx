'use client';
import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, Mail, Lock, ArrowRight } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { authApi } from '@/lib/api';
import {
  getPasswordStrengthErrors,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-validation';
import PublicRoute from '@/components/PublicRoute';

import { useSearchParams } from 'next/navigation';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParams = searchParams.get('redirect');
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
    const normalizedPhone = normalizePhone(formData.phone);
    const normalizedEmail = normalizeEmail(formData.email);
    const passwordErrors = getPasswordStrengthErrors(formData.password);

    if (!isValidPhone(normalizedPhone)) {
      setError('Enter a valid phone number with 10 to 15 digits.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (passwordErrors.length > 0) {
      setError(passwordErrors[0]);
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.phoneSignup(normalizedPhone, normalizedEmail, formData.password);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to send code');

      const verifyUrl = `/verify-otp?phone=${encodeURIComponent(normalizedPhone)}&email=${encodeURIComponent(normalizedEmail)}&mode=signup${redirectParams ? `&redirect=${encodeURIComponent(redirectParams)}` : ''}`;
      router.push(verifyUrl);
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
          <SignupIllustration />
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-(--text-primary)">Create Account</h1>
          <p className="text-(--text-secondary)">Use your phone number, email and password to continue.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <Input
              icon={Smartphone}
              placeholder="+1 555 000 0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: normalizePhone(e.target.value) })}
              type="tel"
              required
            />
            <Input
              icon={Mail}
              placeholder="hello@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              type="email"
              required
            />
            <Input
              icon={Lock}
              type="password"
              placeholder="Create password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <p className="text-xs text-(--text-secondary)">
              Use 8+ characters with uppercase, lowercase, number and symbol.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-(--accent) text-sm rounded-2xl text-center font-medium">
              {error}
            </div>
          )}

          <Button type="submit" isLoading={loading} variant="accent">
            Get Verification Code
            {!loading && <ArrowRight size={18} />}
          </Button>
        </form>

        {/* Log In Link */}
        <div className="text-center pt-4">
          <p className="text-(--text-secondary) text-sm">
            Already have an account?{' '}
            <button
              onClick={() => router.push(`/login${redirectParams ? `?redirect=${encodeURIComponent(redirectParams)}` : ''}`)}
              className="text-(--accent) font-bold hover:underline transition-colors duration-300"
            >
              Log In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <PublicRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-(--background) flex items-center justify-center">
            Loading...
          </div>
        }
      >
        <SignupContent />
      </Suspense>
    </PublicRoute>
  );
}

const SignupIllustration = () => (
  <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Background circle */}
    <circle cx="100" cy="90" r="85" fill="#F3F4F6" opacity="0.5" />

    {/* Welcome hand gesture and shoe */}
    <g transform="translate(35, 50)">
      {/* Hand */}
      <circle cx="25" cy="25" r="8" fill="#1F2937" />
      <path d="M 25 33 L 22 45 M 25 33 L 25 48 M 25 33 L 28 45" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />

      {/* Waving motion - curved line */}
      <path d="M 35 15 Q 40 10 45 15" stroke="#FF6B6B" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Shoe with shine */}
      <g transform="translate(40, 25)">
        <path d="M 5 20 Q 2 15 8 8 Q 15 5 25 6 Q 32 8 35 15 Q 35 20 30 25 L 28 35 Q 25 38 15 40 Q 5 38 8 35 Z" fill="#FF6B6B" />
        <path d="M 10 12 Q 12 10 18 9" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.7" />
        <circle cx="20" cy="22" r="1.5" fill="#FFFFFF" opacity="0.5" />
      </g>
    </g>

    {/* Celebration stars */}
    <g opacity="0.6">
      <path d="M 60 35 L 61.5 40 L 67 40.5 L 62.5 44 L 64 49 L 60 45.5 L 56 49 L 57.5 44 L 53 40.5 L 58.5 40 Z" fill="#FF6B6B" />
      <path d="M 140 50 L 141 54 L 145 54.5 L 141.5 57.5 L 142.5 61.5 L 140 58.5 L 137.5 61.5 L 138.5 57.5 L 135 54.5 L 139 54 Z" fill="#FF6B6B" opacity="0.5" />
      <path d="M 50 120 L 50.8 123 L 54 123.3 L 51.5 125.5 L 52.3 128.5 L 50 126.5 L 47.7 128.5 L 48.5 125.5 L 46 123.3 L 49.2 123 Z" fill="#FF6B6B" opacity="0.4" />
    </g>

    {/* Decorative elements */}
    <circle cx="25" cy="45" r="2" fill="#FF6B6B" opacity="0.3" />
    <circle cx="165" cy="65" r="2.5" fill="#1F2937" opacity="0.15" />
  </svg>
);
