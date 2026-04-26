'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { authApi } from '@/lib/api';
import {
  Bars3Icon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
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

    if (user) {
      fetchUserName();
    }
  }, [user]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Bars3Icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>

        <h2 className="text-base font-normal text-gray-900 dark:text-gray-100 hidden sm:block">
          Welcome back!
        </h2>
      </div>

      <div className="flex items-center space-x-1">
        <ThemeToggle />
        
        <div className="relative">
          <button
            onClick={toggleDropdown}
            className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="User menu"
          >
            <UserCircleIcon className="w-7 h-7 text-gray-700 dark:text-gray-300" />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {userName || `User #${user?.user_id}` || 'Guest'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{user?.role || 'Unknown'}</p>
            </div>
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsDropdownOpen(false)}
              />

              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-300 dark:border-gray-700 z-20">
                <div className="py-1">
                  <button
                    onClick={() => {
                      router.push('/dashboard/profile');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left text-sm"
                  >
                    <UserCircleIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    <span className="text-gray-900 dark:text-gray-100">Profile</span>
                  </button>

                  <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-50 text-sm"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-red-600 dark:text-red-400">
                      {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
