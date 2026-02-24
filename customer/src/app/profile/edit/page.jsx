'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import LoginPrompt from '@/components/LoginPrompt';
import { userApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  AlertCircle,
  CheckCircle,
  Loader,
  ChevronLeft,
} from 'lucide-react';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, isLoading, refreshUser } = useAuth();
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Populate form when user data is available
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setPhoneNumber(user.phone || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await userApi.updateProfile(fullName, email);

      if (response.success) {
        setUser(response.data.user);
        setSuccessMessage('Profile updated successfully');
        setTimeout(() => {
          setSuccessMessage('');
          router.push('/profile');
        }, 2000);
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePhone = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setError('Valid phone number is required (at least 10 digits)');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await userApi.updatePhoneNumber(phoneNumber);

      if (response.success) {
        // Refresh user data from context
        await refreshUser();
        setSuccessMessage('Phone number updated successfully');
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        setError(response.message || 'Failed to update phone');
      }
    } catch (err) {
      setError(err.message || 'Failed to update phone');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="animate-spin mx-auto mb-4 text-orange-500" size={32} />
            <p className="text-slate-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <LoginPrompt
          title="Edit Your Profile"
          message="Log in to update your personal information and preferences"
          showGuestOption={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <div className="flex-1 max-w-4xl mx-auto w-full py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/profile')}
            className="text-slate-600 hover:text-slate-800 transition"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Edit Profile</h1>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Profile Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-600 mb-2 font-medium">Full Name</p>
            <p className="text-lg font-bold text-slate-900">{user.fullName}</p>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-600 mb-2 font-medium">Email</p>
            <p className="text-lg font-bold text-slate-900 break-all">{user.email}</p>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-600 mb-2 font-medium">Phone</p>
            <p className="text-lg font-bold text-slate-900">{user.phone || 'Not set'}</p>
          </div>
        </div>

        {/* Basic Information Form */}
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-8 border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Basic Information</h2>

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-3">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-slate-50"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-3">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-slate-50"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white px-8 py-3 rounded-2xl font-bold transition flex items-center gap-2"
              >
                {submitting && <Loader className="animate-spin" size={20} />}
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/profile')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-900 px-8 py-3 rounded-2xl font-bold transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Phone Update Form */}
        <div className="bg-white rounded-3xl shadow-lg p-8 border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Update Phone Number</h2>

          <form onSubmit={handleUpdatePhone} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-3">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-slate-50"
                placeholder="Enter your phone number"
                required
              />
              <p className="text-sm text-slate-500 mt-2">At least 10 digits required</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white px-8 py-3 rounded-2xl font-bold transition flex items-center gap-2"
            >
              {submitting && <Loader className="animate-spin" size={20} />}
              {submitting ? 'Updating...' : 'Update Phone'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
