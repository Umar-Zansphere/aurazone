'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Mail, MessageSquare } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { authApi } from '@/lib/api';
import PublicRoute from '@/components/PublicRoute';

function ForgotPasswordContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await authApi.forgotPassword(email);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Error sending email');
      
      setMessage('Password reset instructions have been sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--background) flex flex-col">
      {/* Back Button */}
      <div className="pt-6 px-6">
        <button 
          onClick={() => router.back()}
          aria-label="Go back"
          className="p-3 -ml-3 hover:bg-gray-100 rounded-full transition-colors duration-300"
        >
          <ChevronLeft size={24} className="text-(--text-primary)" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-(--text-primary)">Forgot Password?</h1>
            <p className="text-(--text-secondary) text-sm">
              Select which contact details should we use to reset your password
            </p>
          </div>

          {/* Illustration */}
          <div className="flex justify-center py-6">
            <div className="w-40 h-40 bg-(--img-bg) rounded-full flex items-center justify-center relative shadow-md">
              <div className="absolute top-4 right-4 bg-black text-white p-2 rounded-full shadow-md">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
              <LockIconLarge />
            </div>
          </div>

          {/* Contact Options */}
          <div className="space-y-4">
            {/* Disabled SMS option */}
            <div className="border-2 border-gray-200 rounded-2xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed transition-all">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                <MessageSquare size={20} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-(--text-secondary) font-medium">via SMS (Unavailable)</p>
                <p className="font-semibold text-gray-400 text-sm mt-1">Phone verification only for Login</p>
              </div>
            </div>

            {/* Email Option - Active */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-2 border-black rounded-2xl p-5 flex items-center gap-4 bg-white shadow-md ring-1 ring-black/5 transition-all">
                <div className="w-12 h-12 rounded-full bg-(--img-bg) flex items-center justify-center text-(--text-primary) shrink-0">
                  <Mail size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-(--text-secondary) font-medium">via Email</p>
                  <Input 
                    placeholder="Enter your email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-none p-0 h-auto mt-2 focus:ring-0 shadow-none bg-transparent placeholder:text-gray-300 font-semibold text-base"
                    type="email"
                    required
                  />
                </div>
              </div>

              {message && (
                <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-2xl text-center font-medium">
                  ✓ {message}
                </div>
              )}
              
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-(--accent) text-sm rounded-2xl text-center font-medium">
                  {error}
                </div>
              )}

              <Button onClick={handleSubmit} isLoading={loading} variant="accent" className="mt-8">
                Continue
              </Button>
            </form>
          </div>
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

const LockIconLarge = () => (
  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);