/**
 * CANDIDATE DASHBOARD HOME PAGE
 * 
 * Why: The dashboard home is the first page candidates see after login. It should provide
 * an overview of their account status, quick actions (upload resume, view profile), and
 * relevant statistics. This page serves as the central hub for all candidate activities.
 * 
 * System Flow: User logs in → 2FA verified → Redirected to /dashboard/candidate → This page
 * renders → Shows welcome message, resume status, and action cards → User clicks action →
 * Navigates to specific feature page.
 * 
 * Senior Principle: Dashboard as a command center. The home page should provide quick access
 * to all major features without overwhelming the user with information. Progressive disclosure
 * through action cards guides users to their next steps.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  DocumentTextIcon,
  UserCircleIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface StatCard {
  title: string;
  value: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
}

interface ActionCard {
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href: string;
  color: string;
}

export default function CandidateDashboard() {
  const router = useRouter();
  const { user, initializeAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');

  /**
   * INITIALIZE AUTH & VALIDATE ROLE
   * 
   * Why: When the dashboard loads, we must restore auth state from localStorage and verify
   * the user has the correct role. If a user somehow bypasses middleware (e.g., by manipulating
   * localStorage), this client-side check provides an additional security layer.
   * 
   * System Flow: Component mounts → initializeAuth() called → Reads token from localStorage →
   * Decodes JWT → Populates user state → Checks role → If not candidate, redirects to correct
   * dashboard → If candidate, shows dashboard content.
   * 
   * Senior Principle: Defense in depth. Security checks at multiple layers (middleware, client,
   * backend) ensure unauthorized access is caught even if one layer fails.
   */
  useEffect(() => {
    initializeAuth();
    
    // Check if user is authenticated
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    
    if (!token) {
      // No token found - redirect to login
      router.push('/login');
      return;
    }
    
    // Fetch user name
    const fetchUserName = async () => {
      try {
        const response = await authApi.get('/profile');
        if (response.data.name) {
          setUserName(response.data.name);
        }
      } catch (error) {
        console.error('Failed to fetch user name:', error);
      }
    };
    
    fetchUserName();
    
    // Simulate loading state for better UX
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [initializeAuth, router]);

  /**
   * ROLE VALIDATION - REDIRECT IF UNAUTHORIZED
   * 
   * Why: Even though middleware should prevent HR users from accessing this page, we add
   * client-side validation as a safety net. If a user's role doesn't match, redirect them
   * to the appropriate dashboard. This prevents confusion and enforces RBAC.
   * 
   * System Flow: user state updates → useEffect triggers → Checks user.role → If 'hr',
   * redirects to /dashboard/hr → If 'candidate', continues rendering.
   * 
   * Senior Principle: Fail-secure by default. If role validation fails or user is null,
   * assume unauthorized and redirect to login.
   */
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role !== 'candidate') {
        router.push('/dashboard/hr');
      }
    }
  }, [user, isLoading, router]);

  /**
   * STATISTICS CARDS CONFIGURATION
   * 
   * Why: Visual statistics provide quick insights into the candidate's account status.
   * These cards show resume status, profile completion, views, and last activity. In a
   * production app, these would be fetched from the backend API.
   * 
   * System Flow: Component renders → Maps statCards array → Renders each card with icon,
   * title, and value → User sees account overview at a glance.
   * 
   * Senior Principle: Data-driven UI. Statistics should be real-time and actionable,
   * helping users understand their account status and next steps.
   */
  const statCards: StatCard[] = [
    {
      title: 'Resume Status',
      value: 'Not Uploaded',
      icon: DocumentTextIcon,
      color: 'text-blue-600',
    },
    {
      title: 'Profile Completion',
      value: '60%',
      icon: UserCircleIcon,
      color: 'text-green-600',
    },
    {
      title: 'Profile Views',
      value: '0',
      icon: ChartBarIcon,
      color: 'text-purple-600',
    },
    {
      title: 'Last Activity',
      value: 'Just now',
      icon: ClockIcon,
      color: 'text-orange-600',
    },
  ];

  /**
   * ACTION CARDS CONFIGURATION
   * 
   * Why: Action cards guide users to their next steps. New candidates need to upload their
   * resume and complete their profile. These cards provide clear CTAs with descriptions,
   * reducing friction and improving onboarding completion rates.
   * 
   * System Flow: User views dashboard → Sees action cards → Clicks card → Navigates to
   * feature page → Completes action → Returns to dashboard → Card updates to reflect completion.
   * 
   * Senior Principle: Progressive onboarding. Guide users through essential setup steps
   * with clear, actionable cards rather than overwhelming them with all features at once.
   */
  const actionCards: ActionCard[] = [
    {
      title: 'Upload Your Resume',
      description: 'Upload your resume to get matched with relevant job opportunities.',
      icon: DocumentTextIcon,
      href: '/dashboard/candidate/resume',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      title: 'Complete Your Profile',
      description: 'Add your skills, experience, and preferences to improve your matches.',
      icon: UserCircleIcon,
      href: '/dashboard/profile',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {userName || `User #${user?.user_id}`}!
          </h1>
          <p className="text-blue-100">
            Manage your resume, track your applications, and get matched with opportunities.
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <Icon className={`w-8 h-8 ${stat.color}`} />
                </div>
                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {actionCards.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  onClick={() => router.push(action.href)}
                  className={`${action.color} border rounded-lg p-6 text-left transition-all hover:shadow-md`}
                >
                  <Icon className="w-10 h-10 text-gray-700 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activity to display.</p>
            <p className="text-sm text-gray-400 mt-2">
              Start by uploading your resume or completing your profile.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
