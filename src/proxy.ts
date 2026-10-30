import { NextResponse, type NextRequest } from 'next/server';

/**
 * Coarse gate for /app: presence of the signed session cookie only.
 * Real verification (getUser against Supabase) happens in the protected layout
 * and in every endpoint; this proxy never authorizes data access.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get('denta-auth')?.value);
  if (pathname.startsWith('/app') && !hasSession) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
