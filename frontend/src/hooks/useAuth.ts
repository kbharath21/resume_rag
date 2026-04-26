import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * USE AUTH HOOK - AUTHENTICATION OPERATIONS
 *
 * Why: Extracting authentication logic into a custom hook makes it reusable across
 * multiple components and keeps components focused on rendering. This follows the
 * separation of concerns principle and makes testing easier.
 *
 * System Flow: Component calls useAuth() → Gets login/register/logout functions →
 * Component calls login(email, password) → Hook calls authApi → Updates Zustand store
 * → Hook returns success/error → Component handles response.
 *
 * Senior Principle: Custom hooks for business logic. React hooks encapsulate stateful
 * logic and make it reusable without higher-order components or render props.
 */

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials extends LoginCredentials {
  role: 'candidate' | 'hr';
}

interface AuthResponse {
  success: boolean;
  error?: string;
}

export const useAuth = () => {
  const router = useRouter();
  const { setToken, logout: logoutStore } = useAuthStore();

  /**
   * LOGIN FUNCTION
   * Sends credentials to auth service and handles response
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      try {
        const response = await authApi.post('/login', credentials);

        if (response.data.access_token) {
          setToken(response.data.access_token);

          // Redirect to appropriate dashboard based on role
          const user = useAuthStore.getState().user;
          const dashboardUrl =
            user?.role === 'candidate' ? '/dashboard/candidate' : '/dashboard/hr';
          router.push(dashboardUrl);

          return { success: true };
        }

        return { success: false, error: 'Login failed' };
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.detail ||
          error.message ||
          'An error occurred during login';
        return { success: false, error: errorMessage };
      }
    },
    [setToken, router]
  );

  /**
   * REGISTER FUNCTION
   * Sends registration data to auth service and handles response
   */
  const register = useCallback(
    async (credentials: RegisterCredentials): Promise<AuthResponse> => {
      try {
        const response = await authApi.post('/register', credentials);

        if (response.status === 201 || response.status === 200) {
          // Registration successful, redirect to login
          router.push('/login?message=Registration successful. Please log in.');
          return { success: true };
        }

        return { success: false, error: 'Registration failed' };
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.detail ||
          error.message ||
          'An error occurred during registration';
        return { success: false, error: errorMessage };
      }
    },
    [router]
  );

  /**
   * LOGOUT FUNCTION
   * Clears auth state and redirects to login
   */
  const logout = useCallback(async (): Promise<void> => {
    await logoutStore();
    router.push('/login');
  }, [logoutStore, router]);

  return { login, register, logout };
};
