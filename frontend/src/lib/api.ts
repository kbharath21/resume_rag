import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * AUTH API INSTANCE CONFIGURATION
 * 
 * Why: The authentication service runs on port 3002 and handles login, registration, token refresh,
 * and logout operations. By creating a separate instance, we can manage auth-specific error handling
 * (like 401 responses triggering logout) independently from search operations.
 * 
 * System Flow: User credentials → authApi.post('/login') → Port 3002 → Returns access_token & refresh_token
 * as JSON → Stored in localStorage → Request interceptor automatically attaches Bearer token.
 * 
 * Senior Principle: Defense in depth through service isolation. Each microservice has its own
 * API client with tailored error handling, preventing cascading failures across the system.
 */
export const authApi: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3002',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * SEARCH API INSTANCE CONFIGURATION
 * 
 * Why: The search and HR management service runs on port 3001 and handles candidate search,
 * job posting management, and outreach campaigns. Separating this from auth allows independent
 * rate limiting, caching strategies, and error handling specific to search operations.
 * 
 * System Flow: Search query → searchApi.post('/search_candidates') → Port 3001 → Returns
 * candidate results with relevance scores. Request interceptor ensures access_token is attached.
 * 
 * Senior Principle: Microservices architecture with independent API clients. Each service
 * can be versioned, scaled, and monitored independently without affecting other services.
 */
export const searchApi: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SEARCH_API_URL || 'http://localhost:3001',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * STORING API INSTANCE CONFIGURATION
 * 
 * Why: The storing service runs on port 3000 and handles resume uploads and ingestion.
 * This service processes PDF files, extracts text, generates embeddings, and stores
 * them in Milvus for semantic search.
 * 
 * System Flow: User uploads resume → storingApi.post('/ingest_resume_file') → Port 3000 →
 * PDF parsed → Text extracted → Embeddings generated → Stored in Milvus → Returns success.
 * 
 * Senior Principle: Microservices architecture with specialized services. Resume processing
 * is compute-intensive and should be isolated from search and auth services.
 */
export const storingApi: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_STORING_API_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * REQUEST INTERCEPTOR - BEARER TOKEN ATTACHMENT
 * 
 * Why: The backend expects the access_token as a Bearer token in the Authorization header.
 * This interceptor runs before every request, ensuring the token is always present without
 * requiring manual attachment in every API call. Tokens are stored in localStorage for
 * persistence across page refreshes.
 * 
 * System Flow: Request initiated → Interceptor reads access_token from localStorage
 * → Adds "Authorization: Bearer {token}" header → Request sent to backend → Backend validates token.
 * 
 * Senior Principle: Centralized cross-cutting concern handling. Token attachment is a
 * security-critical operation that should be enforced consistently across all requests.
 */
const setupRequestInterceptors = (apiInstance: AxiosInstance) => {
  apiInstance.interceptors.request.use(
    (config) => {
      // Extract access_token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

/**
 * RESPONSE INTERCEPTOR - 401 ERROR HANDLING & TOKEN REFRESH (SLIDING WINDOW)
 * 
 * Why: When a 401 Unauthorized response is received, it means the access_token is invalid or expired.
 * Rather than forcing the user to manually log in, we attempt to refresh the token using the refresh_token.
 * This implements the "sliding window" pattern where active users never experience session expiration.
 * 
 * System Flow: API returns 401 → Interceptor catches error → Reads refresh_token from localStorage
 * → Calls /refresh?refresh_token={token} → Backend validates and returns new tokens → Stores new tokens
 * → Retries original request with new access_token → User never notices the token expired.
 * 
 * Senior Principle: Graceful degradation with security-first approach. Failed authentication is handled
 * transparently to the user, but security is never compromised (tokens are always cleared on auth failure).
 * Token family rotation in the backend prevents token reuse attacks.
 */
const setupResponseInterceptors = (apiInstance: AxiosInstance) => {
  apiInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      // Handle 401 Unauthorized - Token Refresh (Sliding Window)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // Get refresh_token from localStorage
          const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          // Attempt to refresh the access token
          // Backend expects: POST /refresh?refresh_token={token}
          const refreshResponse = await axios.post(
            `${process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3002'}/refresh?refresh_token=${refreshToken}`,
            {},
            { withCredentials: true }
          );

          // If refresh successful, store new tokens
          if (refreshResponse.status === 200 && refreshResponse.data.access_token) {
            const { access_token, refresh_token } = refreshResponse.data;
            
            // Store new tokens in localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('refresh_token', refresh_token);
            }

            // Update Authorization header for retry
            originalRequest.headers.Authorization = `Bearer ${access_token}`;

            // Retry the original request with new token
            return apiInstance(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed - clear auth state and redirect to login
          const authStore = useAuthStore.getState();
          authStore.logout();

          // Clear tokens from localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          }

          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login?error=session_expired';
          }

          return Promise.reject(refreshError);
        }
      }

      // Handle 429 Rate Limit
      if (error.response?.status === 429) {
        console.warn('Rate limit exceeded. Please try again later.');
      }

      // Handle 403 Forbidden
      if (error.response?.status === 403) {
        console.warn('Access denied. You do not have permission to access this resource.');
      }

      return Promise.reject(error);
    }
  );
};

// Apply interceptors to all API instances
setupRequestInterceptors(authApi);
setupRequestInterceptors(searchApi);
setupRequestInterceptors(storingApi);
setupResponseInterceptors(authApi);
setupResponseInterceptors(searchApi);
setupResponseInterceptors(storingApi);
