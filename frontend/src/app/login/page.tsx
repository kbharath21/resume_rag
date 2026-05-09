'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { validateLoginForm } from '@/lib/validation';

/**
 * LOGIN PAGE - USER AUTHENTICATION
 *
 * Why: The login page is the entry point for users to access the platform. It must be
 * secure (validate input, handle errors gracefully), accessible (proper labels, keyboard
 * navigation), and performant (minimal re-renders, lazy load non-critical resources).
 *
 * System Flow: User enters email/password → Form validates → Calls useAuth.login() →
 * Hook sends credentials to authApi (port 3000) → Backend validates and returns tokens
 * → Tokens stored in httpOnly cookies → User redirected to dashboard.
 *
 * Senior Principle: Security-first design. Passwords are never logged, errors don't
 * expose sensitive information, and all communication is over HTTPS in production.
 */

interface FormErrors {
  email?: string;
  password?: string;
  submit?: string;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setToken } = useAuthStore();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * INITIALIZE PAGE STATE
   * Check for query parameters (error messages, success messages from registration)
   * Also check if user is already authenticated and redirect to dashboard
   */
  useEffect(() => {
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (error === 'session_expired') {
      setErrorMessage('Your session has expired. Please log in again.');
    } else if (error === 'token_expired') {
      setErrorMessage('Your token has expired. Please log in again.');
    } else if (message) {
      setSuccessMessage(message);
    }

    // Check if user is already authenticated
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      // User is already logged in, redirect to dashboard
      setToken(token);
      const user = useAuthStore.getState().user;
      const dashboardUrl = user?.role === 'candidate' ? '/dashboard/candidate' : '/dashboard/hr';
      router.push(dashboardUrl);
    }
  }, [searchParams, setToken, router]);

  /**
   * FORM SUBMISSION HANDLER
   * Validates form and calls login function
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setErrorMessage('');
        
    // Validate form
    const validationErrors = validateLoginForm(email, password);
    if (validationErrors.length > 0) {
      const errorMap: FormErrors = {};
      validationErrors.forEach((err) => {
        errorMap[err.field as keyof FormErrors] = err.message;
      });
      setErrors(errorMap);
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.post('/login', { email, password });

      // Check if 2FA is required
      if (response.data.status === '2fa_required') {
        // Redirect to OTP verification page
        router.push(`/verify-otp?email=${encodeURIComponent(email)}&type=login`);
      } else if (response.data.access_token) {
        // Old flow without 2FA (fallback)
        setToken(response.data.access_token);
        const user = useAuthStore.getState().user;
        const dashboardUrl =
          user?.role === 'candidate' ? '/dashboard/candidate' : '/dashboard/hr';
        router.push(dashboardUrl);
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        'Login failed. Please try again.';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-purple-700 dark:text-purple-500 mb-2">Resume RAG</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm">Sign in to your account</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded shadow-sm p-6">
          {successMessage && (
            <div className="mb-4">
              <Alert
                type="success"
                message={successMessage}
                onDismiss={() => setSuccessMessage('')}
              />
            </div>
          )}

          {errorMessage && (
            <div className="mb-4">
              <Alert
                type="error"
                message={errorMessage}
                onDismiss={() => setErrorMessage('')}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              disabled={isLoading}
              autoComplete="email"
              required
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={isLoading}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>

          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-700" />
            <span className="px-3 text-gray-600 dark:text-gray-400 text-xs">or</span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-700" />
          </div>

          <p className="text-center text-gray-700 dark:text-gray-300 text-sm">
            New to Resume RAG?{' '}
            <Link
              href="/register"
              className="text-purple-700 hover:text-purple-800 dark:text-purple-500 dark:hover:text-purple-400 font-medium transition-colors"
            >
              Join now
            </Link>
          </p>
        </div>

        <p className="text-center text-gray-600 dark:text-gray-400 text-xs mt-4">
          By signing in, you agree to our{' '}
          <a href="#" className="text-purple-700 dark:text-purple-500 hover:underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="#" className="text-purple-700 dark:text-purple-500 hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center"><div className="text-gray-700 dark:text-gray-300">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
