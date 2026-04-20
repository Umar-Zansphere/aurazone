'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronLeft, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { authApi } from '@/lib/api';
import { getPasswordStrengthErrors } from '@/lib/auth-validation';
import PublicRoute from '@/components/PublicRoute';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('This reset link is missing a token. Request a new password reset email.');
      return;
    }

    const passwordErrors = getPasswordStrengthErrors(formData.password);
    if (passwordErrors.length > 0) {
      setError(passwordErrors[0]);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword(token, formData.password);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Unable to reset password');

      setSuccess(data.message || 'Password reset successfully.');
      setFormData({ password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--background) flex flex-col px-4">
      <div className="pt-6">
        <button
          onClick={() => router.push('/login')}
          aria-label="Back to login"
          className="p-3 -ml-3 hover:bg-gray-100 rounded-full transition-colors duration-300"
        >
          <ChevronLeft size={24} className="text-(--text-primary)" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-center">
            <div className="w-28 h-28 bg-(--img-bg) rounded-full flex items-center justify-center shadow-sm">
              {success ? (
                <ShieldCheck size={48} className="text-green-700" strokeWidth={1.5} />
              ) : (
                <KeyRound size={48} className="text-(--text-primary)" strokeWidth={1.5} />
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-(--text-primary)">
              {success ? 'Password updated' : 'Create new password'}
            </h1>
            <p className="text-(--text-secondary)">
              {success
                ? 'You can now sign in with your new password.'
                : 'Choose a strong password so your account stays protected.'}
            </p>
          </div>

          {success ? (
            <div className="space-y-6">
              <div className="p-5 bg-green-50 border border-green-200 text-green-800 text-sm rounded-2xl text-center font-medium">
                {success}
              </div>

              <Button type="button" variant="primary" onClick={() => router.push('/login')}>
                Go to Login
                <ArrowRight size={18} />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {!token && (
                <div className="p-4 bg-red-50 border border-red-200 text-(--accent) text-sm rounded-2xl text-center font-medium">
                  This reset link is missing a token. Request a new password reset email.
                </div>
              )}

              <div className="space-y-5">
                <Input
                  icon={Lock}
                  type="password"
                  placeholder="New password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={!token}
                />
                <Input
                  icon={Lock}
                  type="password"
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  disabled={!token}
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

              <Button type="submit" isLoading={loading} variant="accent" disabled={!token || loading}>
                Reset Password
                {!loading && <ArrowRight size={18} />}
              </Button>
            </form>
          )}

          <p className="text-center text-(--text-secondary) text-sm">
            Need a new link?{' '}
            <Link href="/forgot-password" className="text-(--accent) font-bold hover:underline transition-colors duration-300">
              Request another email
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <PublicRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-(--background) flex items-center justify-center">
            Loading...
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </PublicRoute>
  );
}
