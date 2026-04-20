'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, Mail, ShieldCheck } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { authApi } from '@/lib/api';
import { isValidEmail, normalizeEmail } from '@/lib/auth-validation';
import PublicRoute from '@/components/PublicRoute';

function ForgotPasswordContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.forgotPassword(normalizedEmail);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Error sending email');

      setSubmittedEmail(normalizedEmail);
      setMessage(data.message || 'Password reset instructions have been sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMessage('');
    setError('');
    setSubmittedEmail('');
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
              <ShieldCheck size={48} className="text-(--text-primary)" strokeWidth={1.5} />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-(--text-primary)">Reset your password</h1>
            <p className="text-(--text-secondary)">
              Enter the email linked to your Aurazone account and we will send a secure reset link.
            </p>
          </div>

          {message ? (
            <div className="space-y-6">
              <div className="p-5 bg-green-50 border border-green-200 text-green-800 text-sm rounded-2xl font-medium space-y-2">
                <p>{message}</p>
                {submittedEmail && (
                  <p className="text-green-700">
                    We sent it to <span className="font-bold">{submittedEmail}</span>. The link expires in 10 minutes.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Button type="button" variant="primary" onClick={() => router.push('/login')}>
                  Back to Login
                  <ArrowRight size={18} />
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Try another email
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                icon={Mail}
                placeholder="hello@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />

              <p className="text-xs text-(--text-secondary)">
                For your security, reset links are single-use and expire after 10 minutes.
              </p>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-(--accent) text-sm rounded-2xl text-center font-medium">
                  {error}
                </div>
              )}

              <Button type="submit" isLoading={loading} variant="accent">
                Send Reset Link
                {!loading && <ArrowRight size={18} />}
              </Button>
            </form>
          )}

          <p className="text-center text-(--text-secondary) text-sm">
            Remember your password?{' '}
            <Link href="/login" className="text-(--accent) font-bold hover:underline transition-colors duration-300">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <PublicRoute>
      <ForgotPasswordContent />
    </PublicRoute>
  );
}
