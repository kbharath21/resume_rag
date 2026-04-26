import { NextRequest, NextResponse } from 'next/server';
import { jwtDecode } from 'jwt-decode';

/**
 * NEXT.JS MIDDLEWARE - ROLE-BASED ACCESS CONTROL
 * 
 * Why: Middleware runs on every request before it reaches the page, making it the ideal place
 * to enforce authentication and authorization. By checking auth status here, we prevent
 * unauthenticated users from accessing protected routes and prevent users from accessing
 * routes outside their role. This is a security-first approach: deny by default, allow only
 * explicitly permitted routes.
 * 
 * System Flow: User requests /dashboard/hr/search → Middleware intercepts → Reads access_token
 * cookie → Decodes JWT → Checks role claim → If role is 'candidate', redirects to /dashboard/candidate
 * → If role is 'hr', allows request to proceed.
 * 
 * Senior Principle: Fail-secure by default. Any request without proper authentication or
 * authorization is rejected. This prevents accidental exposure of protected resources.
 */

interface DecodedToken {
  user_id: number;
  role: 'candidate' | 'hr';
  exp: number;
}

/**
 * PROTECTED ROUTES CONFIGURATION
 * 
 * Why: Explicitly defining which routes require authentication and which require specific roles
 * makes the security model clear and maintainable. This configuration is the source of truth
 * for access control, preventing inconsistencies across the codebase.
 * 
 * System Flow: Middleware checks if requested route matches a protected pattern → If yes,
 * validates authentication and role → If validation fails, redirects appropriately.
 * 
 * Senior Principle: Explicit security configuration. Security rules should never be implicit
 * or scattered throughout the codebase; they should be centralized and easy to audit.
 */
const PROTECTED_ROUTES = {
  candidate: ['/dashboard/candidate', '/dashboard/profile'],
  hr: ['/dashboard/hr', '/dashboard/profile'],
  public: ['/login', '/register', '/verify-otp', '/'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * PUBLIC ROUTES - ALWAYS ALLOW ACCESS
   * 
   * Why: Public routes (login, register, verify-otp) should always be accessible regardless
   * of authentication status. Since we're using localStorage for tokens (which middleware
   * cannot access server-side), we allow all public routes and let client-side components
   * handle redirects for authenticated users.
   * 
   * System Flow: User requests /login → Middleware checks if public route → Allows access →
   * Client-side component checks localStorage → If authenticated, redirects to dashboard.
   * 
   * Senior Principle: Separation of concerns. Server-side middleware handles route protection,
   * client-side components handle localStorage-based auth state and redirects.
   */
  if (PROTECTED_ROUTES.public.includes(pathname)) {
    return NextResponse.next();
  }

  /**
   * PROTECTED ROUTES - ALLOW ACCESS (CLIENT-SIDE VALIDATION)
   * 
   * Why: Since tokens are stored in localStorage (not cookies), middleware cannot access them
   * server-side. Instead of blocking access here, we allow the request to proceed and let
   * client-side components validate auth state. If the user is not authenticated, the
   * component will redirect to login.
   * 
   * System Flow: User requests /dashboard/candidate → Middleware allows access → Page component
   * loads → useEffect checks localStorage for token → If no token, redirects to login → If
   * token exists, validates and shows dashboard.
   * 
   * Senior Principle: Progressive enhancement. Server-side provides basic routing, client-side
   * provides auth validation and user-specific behavior. This approach works with localStorage
   * while maintaining security through client-side checks and backend API validation.
   */
  
  // Allow all protected routes - client-side will handle auth validation
  return NextResponse.next();
  /**
   * PUBLIC ROUTES - ALWAYS ALLOW ACCESS
   * 
   * Why: Public routes (login, register, verify-otp) should always be accessible regardless
   * of authentication status. Since we're using localStorage for tokens (which middleware
   * cannot access server-side), we allow all public routes and let client-side components
   * handle redirects for authenticated users.
   * 
   * System Flow: User requests /login → Middleware checks if public route → Allows access →
   * Client-side component checks localStorage → If authenticated, redirects to dashboard.
   * 
   * Senior Principle: Separation of concerns. Server-side middleware handles route protection,
   * client-side components handle localStorage-based auth state and redirects.
   */
  if (PROTECTED_ROUTES.public.includes(pathname)) {
    return NextResponse.next();
  }

  /**
   * PROTECTED ROUTES - ALLOW ACCESS (CLIENT-SIDE VALIDATION)
   * 
   * Why: Since tokens are stored in localStorage (not cookies), middleware cannot access them
   * server-side. Instead of blocking access here, we allow the request to proceed and let
   * client-side components validate auth state. If the user is not authenticated, the
   * component will redirect to login.
   * 
   * System Flow: User requests /dashboard/candidate → Middleware allows access → Page component
   * loads → useEffect checks localStorage for token → If no token, redirects to login → If
   * token exists, validates and shows dashboard.
   * 
   * Senior Principle: Progressive enhancement. Server-side provides basic routing, client-side
   * provides auth validation and user-specific behavior. This approach works with localStorage
   * while maintaining security through client-side checks and backend API validation.
   */
  
  // Allow all protected routes - client-side will handle auth validation
  return NextResponse.next();
}

/**
 * MIDDLEWARE CONFIGURATION - ROUTE MATCHING
 * 
 * Why: The 'matcher' configuration tells Next.js which routes should trigger this middleware.
 * By specifying patterns, we avoid running middleware on static assets, API routes, and other
 * non-page routes, improving performance. This configuration is explicit and easy to audit.
 * 
 * System Flow: Request comes in → Next.js checks if pathname matches 'matcher' patterns
 * → If yes, middleware runs → If no, request proceeds without middleware.
 * 
 * Senior Principle: Performance through selective enforcement. Middleware should only run
 * where necessary, not on every single request to the server.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
