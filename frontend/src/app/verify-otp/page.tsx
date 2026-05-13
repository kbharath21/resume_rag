'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function VerifyOTPPage() {
  const router = useRouter();
  const { setToken } = useAuthStore();

  const [email, setEmail] = useState('');
  const [type, setType] = useState('register');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Get email and type from URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email') || '';
      const typeParam = params.get('type') || 'register';
      
      setEmail(emailParam);
      setType(typeParam);

      if (!emailParam) {
        router.push('/login');
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      if (type === 'register') {
        const response = await authApi.post('/verify-account', {
          email,
          code,
        });

        if (response.data.status === 'success') {
          setSuccessMessage('Account verified! Redirecting to login...');
          setTimeout(() => {
            router.push('/login?message=Account verified. Please log in.');
          }, 2000);
        }
      } else {
        // Login 2FA verification
        const response = await authApi.post('/verify-2fa-login', {
          email,
          code,
        });

        if (response.data.access_token && response.data.refresh_token) {
          // Store tokens in localStorage (backend returns JSON, not cookies)
          localStorage.setItem('access_token', response.data.access_token);
          localStorage.setItem('refresh_token', response.data.refresh_token);
          
          // Update Zustand store
          setToken(response.data.access_token);
          setSuccessMessage('Login successful! Redirecting...');
          
          const user = useAuthStore.getState().user;
          const dashboardUrl =
            user?.role === 'candidate' ? '/dashboard/candidate' : '/dashboard/hr';
          
          setTimeout(() => {
            router.push(dashboardUrl);
          }, 1000);
        }
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail ||
        err.message ||
        'Verification failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Verify Code
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Enter the 6-digit code sent to <strong className="text-gray-900 dark:text-white">{email}</strong>
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-8">
          {successMessage && (
            <div className="mb-4">
              <Alert type="success" message={successMessage} />
            </div>
          )}

          {error && (
            <div className="mb-4">
              <Alert
                type="error"
                message={error}
                onDismiss={() => setError('')}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="code"
              type="text"
              label="Verification Code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isLoading}
              maxLength={6}
              autoComplete="one-time-code"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full"
            >
              Verify Code
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Didn't receive the code?{' '}
              <button
                onClick={() => router.back()}
                className="text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400 font-semibold transition-colors"
                disabled={isLoading}
              >
                Go back
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
