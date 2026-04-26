import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { authApi } from '@/lib/api';

/**
 * AUTH STORE TYPE DEFINITIONS
 * 
 * Why: TypeScript interfaces ensure type safety across the entire authentication flow.
 * By defining User and AuthStore types upfront, we prevent runtime errors and enable
 * IDE autocomplete, making the codebase more maintainable and reducing bugs.
 * 
 * System Flow: User logs in → JWT decoded → user_id and role extracted → Stored in this typed state
 * → Components access via useAuthStore hook → Type-safe throughout application.
 * 
 * Senior Principle: Type safety as a security measure. Explicit types prevent accidental
 * data mutations and ensure only valid user data is stored in the auth state.
 */
interface User {
  user_id: number;
  role: 'candidate' | 'hr';
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setToken: (token: string) => void;
  logout: () => void;
  initializeAuth: () => void;
}

/**
 * ZUSTAND AUTH STORE INITIALIZATION
 * 
 * Why: Zustand provides a lightweight, boilerplate-free state management solution that's
 * perfect for authentication. Unlike Redux, it doesn't require actions, reducers, or middleware.
 * The store is a single source of truth for auth state, accessible from any component without
 * prop drilling. This follows the principle of centralized state management.
 * 
 * System Flow: Component calls useAuthStore() → Gets current user state and actions → Can
 * call setToken() or logout() → Store updates → All subscribed components re-render with new state.
 * 
 * Senior Principle: Single source of truth. All authentication state flows through this store,
 * preventing inconsistencies where different parts of the app might have different auth states.
 */
export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  /**
   * SET TOKEN ACTION - JWT DECODING & STATE POPULATION
   * 
   * Why: When the backend returns an access_token after login, we need to extract the user_id
   * and role claims from the JWT without sending them to the backend again. jwt-decode allows
   * client-side decoding without verification (verification happens server-side on each request).
   * This reduces API calls and provides immediate UI updates.
   * 
   * System Flow: Login successful → Backend returns access_token in cookie → setToken(token) called
   * → jwt-decode extracts claims → user_id and role stored in Zustand → UI updates immediately
   * → User redirected to dashboard.
   * 
   * Senior Principle: Minimize API calls for non-critical operations. Decoding JWT client-side
   * is safe because the token is verified on every backend request. This improves UX without
   * compromising security.
   */
  setToken: (token: string) => {
    try {
      const decoded = jwtDecode<{ user_id: number; role: string }>(token);
      set({
        user: {
          user_id: decoded.user_id,
          role: decoded.role as 'candidate' | 'hr',
        },
        error: null,
      });
    } catch (error) {
      console.error('Failed to decode token:', error);
      set({ error: 'Invalid token format' });
    }
  },

  /**
   * LOGOUT ACTION - COMPLETE AUTH STATE CLEANUP
   * 
   * Why: Logout must be comprehensive: clear Zustand state, clear localStorage, and notify the backend.
   * Clearing only the state would leave the refresh_token in storage, allowing potential token reuse.
   * This action ensures complete cleanup across all storage mechanisms.
   * 
   * System Flow: User clicks logout → logout() called → Zustand state cleared → localStorage cleared
   * → Backend /logout endpoint called with refresh_token → Backend blacklists token in Redis
   * → User redirected to /login.
   * 
   * Senior Principle: Defense in depth. Multiple layers of logout (client state, localStorage, server
   * blacklist) ensure that a logged-out user cannot regain access even if they manipulate storage.
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      // Get refresh token from localStorage
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

      if (refreshToken) {
        // Notify backend to blacklist the refresh token
        await authApi.post(`/logout?refresh_token=${refreshToken}`);
      }

      // Clear Zustand state
      set({ user: null, error: null });

      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if backend call fails, clear local state for security
      set({ user: null });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * INITIALIZE AUTH ACTION - RESTORE SESSION ON PAGE LOAD
   * 
   * Why: When a user refreshes the page or returns to the app, we need to restore their auth state
   * from the access_token in localStorage. Without this, the user would appear logged out even though
   * their token is still valid. This action runs on app initialization to provide a seamless experience.
   * 
   * System Flow: App loads → initializeAuth() called → Checks for access_token in localStorage
   * → If found, decodes it → Populates Zustand state → User sees their dashboard without re-logging in.
   * 
   * Senior Principle: Stateless frontend with stateful storage. The frontend doesn't maintain
   * persistent state; instead, it derives state from localStorage on each load, ensuring consistency.
   */
  initializeAuth: () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    if (token) {
      get().setToken(token);
    }
  },
}));
