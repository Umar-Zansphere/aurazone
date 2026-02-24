'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { authApi } from '@/lib/api';
import PublicRoute from '@/components/PublicRoute';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    let mounted = true;

    const verifyToken = async () => {
      if (!token) {
        if (mounted) {
          setStatus('error');
          setMessage('Invalid verification link. Token is missing.');
        }
        return;
      }

      try {
        const res = await authApi.verifyEmail(token);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Verification failed');

        if (mounted) {
          setStatus('success');
          setMessage('Your email has been successfully verified! You can now log in.');
        }
      } catch (err) {
        if (mounted) {
          setStatus('error');
          setMessage(err.message || 'The verification link is invalid or has expired.');
        }
      }
    };

    verifyToken();

    return () => { mounted = false; };
  }, [token]);

  return (
    <div className="min-h-screen bg-(--background) flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">

        {/* Illustration Area */}
        <div className="flex justify-center mb-6">
          <EmailVerificationIllustration status={status} />
        </div>

        {/* Content Area */}
        <div className="bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">

          {/* Status Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-(--text-primary)">
              {status === 'verifying' && 'Verifying Email'}
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Failed'}
            </h1>
            <p className="text-(--text-secondary)">
              {message}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2">
            {status === 'verifying' && (
              <div className="flex justify-center text-(--accent)">
                <Loader2 className="animate-spin h-8 w-8" data-testid="loader-spin" />
              </div>
            )}

            {status === 'success' && (
              <Button
                onClick={() => router.push('/login')}
                variant="primary"
                className="w-full"
              >
                Go to Login
                <ArrowRight size={18} />
              </Button>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <Button
                  onClick={() => router.push('/login')}
                  variant="outline"
                  className="w-full"
                >
                  Back to Login
                </Button>
                <p className="text-xs text-(--text-secondary)">
                  Need help? <button className="text-(--accent) font-semibold hover:underline">Contact Support</button>
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

import { Suspense } from 'react';

export default function VerifyEmailPage() {
  return (
    <PublicRoute>
      <Suspense fallback={<div className="min-h-screen bg-(--background) flex items-center justify-center">Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </PublicRoute>
  );
}

// Custom Illustration matching the style of your Signup page
const EmailVerificationIllustration = ({ status }) => {
  // Colors based on status
  const mainColor = status === 'error' ? '#EF4444' : '#FF6B6B'; // Red or Accent
  const secondaryColor = status === 'success' ? '#10B981' : '#1F2937'; // Green or Dark

  return (
    <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="100" cy="90" r="85" fill="#F3F4F6" opacity="0.5" />

      {/* Floating Elements Group */}
      <g transform="translate(0, 10)">

        {/* Envelope Base */}
        <rect x="60" y="65" width="80" height="60" rx="4" fill="white" stroke={secondaryColor} strokeWidth="2" />

        {/* Envelope Flap */}
        <path d="M 60 65 L 100 95 L 140 65" stroke={secondaryColor} strokeWidth="2" strokeLinejoin="round" fill="none" />

        {/* Dynamic Status Icon */}
        <g transform="translate(100, 95)">
          <circle cx="0" cy="0" r="25" fill="white" stroke={mainColor} strokeWidth="2" />

          {status === 'verifying' && (
            // Simple dots for loading
            <g fill={mainColor}>
              <circle cx="-10" cy="0" r="3" opacity="0.4">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" begin="0s" />
              </circle>
              <circle cx="0" cy="0" r="3" opacity="0.4">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" begin="0.2s" />
              </circle>
              <circle cx="10" cy="0" r="3" opacity="0.4">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" begin="0.4s" />
              </circle>
            </g>
          )}

          {status === 'success' && (
            // Checkmark
            <path d="M -8 1 L -2 7 L 8 -7" stroke={secondaryColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {status === 'error' && (
            // X Mark
            <path d="M -7 -7 L 7 7 M 7 -7 L -7 7" stroke={mainColor} strokeWidth="3" strokeLinecap="round" />
          )}
        </g>
      </g>

      {/* Decorative Stars/Sparkles (Only show on success or verifying) */}
      {status !== 'error' && (
        <g opacity="0.6">
          <path d="M 150 45 L 151.5 50 L 157 50.5 L 152.5 54 L 154 59 L 150 55.5 L 146 59 L 147.5 54 L 143 50.5 L 148.5 50 Z" fill={mainColor} opacity="0.5" />
          <path d="M 50 40 L 51 44 L 55 44.5 L 51.5 47.5 L 52.5 51.5 L 50 48.5 L 47.5 51.5 L 48.5 47.5 L 45 44.5 L 49 44 Z" fill={mainColor} opacity="0.4" />
          <circle cx="160" cy="120" r="2" fill={secondaryColor} opacity="0.2" />
          <circle cx="40" cy="110" r="3" fill={secondaryColor} opacity="0.2" />
        </g>
      )}
    </svg>
  );
};