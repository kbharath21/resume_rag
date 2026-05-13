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
    <header className="h-16 border-b flex items-center justify-between px-6" style={{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--border)' }}>
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg transition-colors"
          style={{ color: 'var(--foreground)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Toggle sidebar"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>

        <h2 className="text-base font-medium hidden sm:block" style={{ color: 'var(--foreground)' }}>
          Welcome back!
        </h2>
      </div>

      <div className="flex items-center space-x-2">
        <ThemeToggle />
        
        <div className="relative">
          <button
            onClick={toggleDropdown}
            className="flex items-center space-x-3 p-2 rounded-lg transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="User menu"
          >
            <UserCircleIcon className="w-8 h-8" style={{ color: 'var(--secondary)' }} />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {userName || `User #${user?.user_id}` || 'Guest'}
              </p>
              <p className="text-xs capitalize" style={{ color: 'var(--muted)' }}>{user?.role || 'Unknown'}</p>
            </div>
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsDropdownOpen(false)}
              />

              <div className="absolute right-0 mt-2 w-48 rounded-lg border z-20 overflow-hidden" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="py-1">
                  <button
                    onClick={() => {
                      router.push('/dashboard/profile');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 transition-colors text-left"
                    style={{ color: 'var(--foreground)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <UserCircleIcon className="w-5 h-5" style={{ color: 'var(--muted)' }} />
                    <span className="text-sm font-medium">Profile</span>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 transition-colors text-left disabled:opacity-50"
                    style={{ color: '#ef4444' }}
                    onMouseEnter={(e) => !isLoggingOut && (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">
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
