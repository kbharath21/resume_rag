'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { authApi } from '@/lib/api';

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
  notice_period: string;
  location: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const isCandidate = user?.role === 'candidate';
  
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: '',
    phone: '',
    notice_period: '',
    location: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authApi.get('/profile');
        setFormData({
          ...formData,
          name: response.data.name || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          notice_period: response.data.notice_period || '',
          location: response.data.location || '',
        });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        setErrorMessage('Failed to load profile data');
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (formData.newPassword || formData.confirmPassword) {
      if (!formData.currentPassword) {
        setErrorMessage('Current password is required to change password.');
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setErrorMessage('New passwords do not match.');
        return;
      }

      if (formData.newPassword.length < 8) {
        setErrorMessage('New password must be at least 8 characters.');
        return;
      }
    }

    setIsLoading(true);

    try {
      await authApi.put('/profile', {
        name: formData.name,
        phone: formData.phone,
        notice_period: isCandidate ? formData.notice_period : undefined,
        location: isCandidate ? formData.location : undefined,
        ...(formData.newPassword && {
          current_password: formData.currentPassword,
          new_password: formData.newPassword,
        }),
      });

      setSuccessMessage('Profile updated successfully!');
      
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.detail || 'Failed to update profile. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your account information
          </p>
        </div>

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
          {/* Personal Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Personal Information
            </h2>
            <div className="space-y-4">
              <Input
                id="name"
                name="name"
                type="text"
                label="Full Name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isLoading}
                required
              />

              <Input
                id="email"
                name="email"
                type="email"
                label="Email Address"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleInputChange}
                disabled={true}
                helperText="Email cannot be changed"
              />

              <Input
                id="phone"
                name="phone"
                type="tel"
                label="Phone Number"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={handleInputChange}
                disabled={isLoading}
              />

              {/* Candidate-specific fields */}
              {isCandidate && (
                <>
                  <div>
                    <label htmlFor="notice_period" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Notice Period
                    </label>
                    <select
                      id="notice_period"
                      name="notice_period"
                      value={formData.notice_period}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="w-full px-3 py-2.5 border rounded transition-all duration-150 focus:outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-base border-gray-400 dark:border-gray-600 focus:border-gray-900 dark:focus:border-white focus:border-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">Select notice period</option>
                      <option value="immediate">Immediate</option>
                      <option value="1_month">1 Month</option>
                      <option value="2_months">2 Months</option>
                      <option value="3_months">3 Months</option>
                      <option value="negotiable">Negotiable</option>
                    </select>
                  </div>

                  <Input
                    id="location"
                    name="location"
                    type="text"
                    label="Location"
                    placeholder="City, Country"
                    value={formData.location}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    helperText="Your current city or preferred work location"
                  />
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Account Role
                </label>
                <div className="inline-flex items-center px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded font-medium text-sm capitalize border border-purple-200 dark:border-purple-800">
                  {user?.role || 'Unknown'}
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Change Password
            </h2>
            <div className="space-y-4">
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                label="Current Password"
                placeholder="Enter current password"
                value={formData.currentPassword}
                onChange={handleInputChange}
                disabled={isLoading}
                autoComplete="current-password"
              />

              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                label="New Password"
                placeholder="Enter new password"
                value={formData.newPassword}
                onChange={handleInputChange}
                disabled={isLoading}
                autoComplete="new-password"
                helperText="Must be at least 8 characters"
              />

              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                label="Confirm New Password"
                placeholder="Re-enter new password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
