'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { authApi } from '@/lib/api';
import { validateRegistrationForm } from '@/lib/validation';

/**
 * REGISTER PAGE - USER ACCOUNT CREATION
 *
 * Why: The registration page allows new users to create accounts with role selection.
 * It must validate input thoroughly (especially passwords for security), provide clear
 * feedback, and guide users through the process. Role selection is critical because it
 * determines which dashboard the user sees after login.
 *
 * System Flow: User enters email/password/role → Form validates → Calls useAuth.register()
 * → Hook sends data to authApi (port 3000) → Backend creates user and stores in PostgreSQL
 * → Returns success → User redirected to login page.
 *
 * Senior Principle: Progressive enhancement. Form works without JavaScript (basic HTML),
 * but with JavaScript we add real-time validation and better UX.
 */

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
  submit?: string;
}

export default function RegisterPage() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'candidate' | 'hr' | ''>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * FORM SUBMISSION HANDLER
   * Validates all fields and calls register function
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setErrorMessage('');

    // Validate form
    const validationErrors = validateRegistrationForm(
      email,
      password,
      confirmPassword,
      role
    );

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
      const response = await authApi.post('/register', {
        email,
        password,
        name: email.split('@')[0], // Use email prefix as name for now
        phone: '', // Optional field
        role: role as 'candidate' | 'hr',
      });

      // Check if verification is required
      if (response.data.status === 'verification_required') {
        // Redirect to OTP verification page
        router.push(`/verify-otp?email=${encodeURIComponent(email)}&type=register`);
      } else {
        // Old flow without verification (fallback)
        router.push('/login?message=Registration successful. Please log in.');
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        'Registration failed. Please try again.';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-purple-700 dark:text-purple-500 mb-2">Resume RAG</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm">Make the most of your professional life</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded shadow-sm p-6">
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
              autoComplete="new-password"
              helperText="Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special"
              required
            />

            <Input
              id="confirmPassword"
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              disabled={isLoading}
              autoComplete="new-password"
              required
            />

            <div>
              <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">
                I am a <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded cursor-pointer transition-colors"
                  style={{
                    borderColor: role === 'candidate' ? '#7c3aed' : (document.documentElement.classList.contains('dark') ? '#4b5563' : '#d1d5db'),
                    backgroundColor: role === 'candidate' ? (document.documentElement.classList.contains('dark') ? '#2d1b4e' : '#ebe7ff') : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value="candidate"
                    checked={role === 'candidate'}
                    onChange={(e) => setRole(e.target.value as 'candidate')}
                    disabled={isLoading}
                    className="w-4 h-4 text-purple-700"
                  />
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      Candidate
                    </span>
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                      Looking for opportunities
                    </span>
                  </div>
                </label>

                <label className="flex items-center p-3 border rounded cursor-pointer transition-colors"
                  style={{
                    borderColor: role === 'hr' ? '#7c3aed' : (document.documentElement.classList.contains('dark') ? '#4b5563' : '#d1d5db'),
                    backgroundColor: role === 'hr' ? (document.documentElement.classList.contains('dark') ? '#2d1b4e' : '#ebe7ff') : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value="hr"
                    checked={role === 'hr'}
                    onChange={(e) => setRole(e.target.value as 'hr')}
                    disabled={isLoading}
                    className="w-4 h-4 text-purple-700"
                  />
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      HR Professional
                    </span>
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                      Recruiting candidates
                    </span>
                  </div>
                </label>
              </div>
              {errors.role && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.role}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full"
            >
              Agree & Join
            </Button>
          </form>

          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-700" />
            <span className="px-3 text-gray-600 dark:text-gray-400 text-xs">or</span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-700" />
          </div>

          <p className="text-center text-gray-700 dark:text-gray-300 text-sm">
            Already on Resume RAG?{' '}
            <Link
              href="/login"
              className="text-purple-700 hover:text-purple-800 dark:text-purple-500 dark:hover:text-purple-400 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-gray-600 dark:text-gray-400 text-xs mt-4">
          By clicking Agree & Join, you agree to our{' '}
          <a href="#" className="text-purple-700 dark:text-purple-500 hover:underline">
            User Agreement
          </a>,{' '}
          <a href="#" className="text-purple-700 dark:text-purple-500 hover:underline">
            Privacy Policy
          </a>, and{' '}
          <a href="#" className="text-purple-700 dark:text-purple-500 hover:underline">
            Cookie Policy
          </a>
        </p>
      </div>
    </div>
  );
}
