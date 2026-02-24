'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import { authApi } from '@/lib/api';
import PublicRoute from '@/components/PublicRoute';

// Separate component for reading search params to avoid hydration issues
function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');
  const mode = searchParams.get('mode'); // 'login' or 'signup'

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(53); // Matching image approximately
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Auto focus next input
    if (element.value && element.nextSibling) {
      element.nextSibling.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && e.target.previousSibling) {
      e.target.previousSibling.focus();
    }
  };

  const handleSubmit = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let res;
      if (mode === 'signup') {
        res = await authApi.phoneSignupVerify(phone, code);
      } else {
        res = await authApi.phoneLoginVerify(phone, code);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      console.log('Verification successful:', data);

      // Authentication state is now managed via cookies set by the backend

      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setTimer(60);
    try {
      if (mode === 'signup') await authApi.phoneSignup(phone);
      else await authApi.phoneLogin(phone);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-(--background) flex flex-col">
      {/* Back Button */}
      <div className="pt-6 px-6">
        <button
          onClick={() => router.back()}
          className="p-3 -ml-3 hover:bg-gray-100 rounded-full transition-colors duration-300"
        >
          <ChevronLeft size={24} className="text-(--text-primary)" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <div className="flex justify-center mb-4">
            <VerifyIllustration />
          </div>

          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-(--text-primary)">Verification Code</h1>
            <p className="text-(--text-secondary) text-sm px-4">
              Code has been sent to <span className="text-(--text-primary) font-semibold">{phone}</span>
            </p>
          </div>

          {/* OTP Input Fields */}
          <div className="flex justify-center gap-2 sm:gap-3">
            {otp.map((data, index) => (
              <input
                key={index}
                type="text"
                name="otp"
                maxLength="1"
                value={data}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={(e) => e.target.select()}
                className="w-11 h-14 sm:w-13 sm:h-16 border-2 border-gray-200 rounded-2xl text-center text-xl font-bold focus:border-(--accent) focus:outline-none focus:shadow-accent shadow-sm transition-all duration-300 bg-(--card-bg) hover:border-gray-300"
              />
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-(--accent) text-center text-sm rounded-2xl font-medium">
              {error}
            </div>
          )}

          {/* Resend Timer */}
          <div className="text-center space-y-3">
            <p className="text-(--text-secondary) text-sm">
              Resend code in <span className="text-(--accent) font-bold">{timer}s</span>
            </p>
            {timer === 0 && (
              <button
                onClick={handleResend}
                className="text-(--accent) font-bold text-sm hover:underline transition-colors duration-300"
              >
                Resend Code
              </button>
            )}
          </div>

          {/* Submit Button */}
          <Button onClick={handleSubmit} isLoading={loading} variant="accent">
            Verify
          </Button>
        </div>
      </div>
    </div>
  );
}

// export default function VerifyPage() {
//   return (
//     <PublicRoute>
//       <Suspense fallback={<div className="min-h-screen bg-(--background) flex items-center justify-center">Loading...</div>}>
//         <VerifyContent />
//       </Suspense>
//     </PublicRoute>
//   );
// }

export default function VerifyOtpPage() {
  return (
    <PublicRoute>
      <Suspense fallback={<div className="min-h-screen bg-(--background) flex items-center justify-center">Loading...</div>}>
        <VerifyContent />
      </Suspense>
    </PublicRoute>
  );
}

const VerifyIllustration = () => (
  <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Background circle */}
    <circle cx="100" cy="90" r="85" fill="#F3F4F6" opacity="0.5" />

    {/* Shield with checkmark */}
    <g transform="translate(55, 40)">
      {/* Shield outline */}
      <path d="M 45 10 L 85 25 L 85 60 Q 85 85 45 100 Q 5 85 5 60 L 5 25 Z" fill="none" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Shield fill - lighter */}
      <path d="M 45 10 L 85 25 L 85 60 Q 85 85 45 100 Q 5 85 5 60 L 5 25 Z" fill="#FF6B6B" opacity="0.1" />

      {/* Checkmark inside shield */}
      <g transform="translate(45, 50)">
        <path d="M 0 15 L 15 30 L 40 5" stroke="#FF6B6B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>

    {/* Lock elements around shield */}
    <g opacity="0.4">
      {/* Lock icon top right */}
      <rect x="130" y="35" width="18" height="18" rx="2" fill="none" stroke="#1F2937" strokeWidth="1.5" />
      <path d="M 135 43 Q 135 40 138 40 Q 141 40 141 43" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="138" cy="47" r="1.5" fill="#1F2937" />

      {/* Lock icon bottom left */}
      <rect x="25" y="115" width="16" height="16" rx="2" fill="none" stroke="#1F2937" strokeWidth="1.5" opacity="0.5" />
      <path d="M 29 121 Q 29 118 32 118 Q 35 118 35 121" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <circle cx="32" cy="125" r="1" fill="#1F2937" opacity="0.5" />
    </g>

    {/* Verification dots animation indicators */}
    <g opacity="0.6">
      <circle cx="70" cy="155" r="2" fill="#FF6B6B" />
      <circle cx="100" cy="155" r="2" fill="#FF6B6B" opacity="0.5" />
      <circle cx="130" cy="155" r="2" fill="#FF6B6B" opacity="0.3" />
    </g>
  </svg>
);