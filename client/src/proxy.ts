import { NextResponse } from 'next/server';
import { auth, getRoleFromAccessToken } from '@/auth';
import { isCustomerRole, isStaffRole } from '@/shared/constants';

/**
 * Protected route groups:
 *
 * Dashboard  → /dashboard/*
 *   Requires: authenticated + (staff or customer role)
 *
 * E-commerce storefront routes → /shop, /products, /categories, /cart, /checkout
 *   Temporarily disabled: redirect to /
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Temporarily disable ecommerce storefront pages
  const isEcommerceRoute =
    pathname.startsWith('/shop') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout');

  if (isEcommerceRoute) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  const isStaffDashboardRoute = pathname.startsWith('/dashboard');

  // Allow remaining public routes (e.g. /, /login) through
  if (!isStaffDashboardRoute) {
    return NextResponse.next();
  }

  // All dashboard routes require authentication
  if (!req.auth?.user?.id) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Dashboard additionally requires a recognised role
  const role = getRoleFromAccessToken(req.auth?.accessToken);
  if (!isStaffRole(role) && !isCustomerRole(role)) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/cart/:path*',
    '/checkout/:path*',
    '/shop/:path*',
    '/products/:path*',
    '/categories/:path*',
  ],
};
