/**
 * DASHBOARD LAYOUT - SHARED LAYOUT FOR ALL DASHBOARD PAGES
 * 
 * Why: A consistent layout across all dashboard pages improves UX and reduces code duplication.
 * This layout provides the structural foundation (sidebar, header, main content area) that all
 * dashboard pages inherit. By centralizing layout logic, we ensure consistent navigation,
 * responsive behavior, and accessibility across the entire dashboard.
 * 
 * System Flow: User navigates to /dashboard/candidate → Next.js renders page.tsx → page.tsx
 * wraps content in <DashboardLayout> → Layout renders Sidebar + Header + children → User sees
 * consistent navigation and can access all dashboard features.
 * 
 * Senior Principle: DRY (Don't Repeat Yourself) through composition. Layout components are
 * reusable containers that provide structure without dictating content, following the
 * Single Responsibility Principle.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, initializeAuth } = useAuthStore();

  /**
   * INITIALIZE AUTH ON MOUNT
   * 
   * Why: When the dashboard loads, we need to restore the user's auth state from localStorage.
   * Without this, the user would appear logged out even though their token is valid. This
   * ensures the dashboard always has access to the current user's role and ID.
   * 
   * System Flow: Dashboard mounts → initializeAuth() called → Reads access_token from localStorage
   * → Decodes JWT → Populates user state → Sidebar and Header can access user.role.
   * 
   * Senior Principle: Stateless components with stateful storage. The component doesn't
   * maintain persistent state; it derives state from localStorage on each mount.
   */
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  /**
   * RESPONSIVE SIDEBAR TOGGLE
   * 
   * Why: On mobile devices, the sidebar should be collapsible to maximize content space.
   * This toggle allows users to show/hide the sidebar, improving mobile UX. The state is
   * managed in the layout so both Header (toggle button) and Sidebar (visibility) can access it.
   * 
   * System Flow: User clicks hamburger icon in Header → toggleSidebar() called → isSidebarOpen
   * state flips → Sidebar component receives new prop → Sidebar animates in/out.
   * 
   * Senior Principle: Lift state up. When multiple components need to share state, lift it
   * to their common parent. This prevents prop drilling and keeps state management centralized.
   */
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar isOpen={isSidebarOpen} userRole={user?.role || 'candidate'} />

      <div className="flex-1 flex flex-col">
        <Header onToggleSidebar={toggleSidebar} />

        <main className="flex-1 p-6 overflow-y-auto gradient-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
