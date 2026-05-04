import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? 'app.shoppingmate.ai';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  // Use hostname from the parsed URL (works in both prod and vitest environments).
  // req.headers.get('host') is null when NextRequest is constructed from a URL
  // string without explicit headers (e.g. in unit tests).
  const hostname = req.nextUrl.hostname;

  const isAppHost =
    hostname === APP_HOST ||
    hostname === APP_HOST.split(':')[0] ||
    hostname.startsWith('app.localhost');

  if (
    isAppHost &&
    !url.pathname.startsWith('/app') &&
    !url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/login') &&
    !url.pathname.startsWith('/signup') &&
    !url.pathname.startsWith('/verify')
  ) {
    url.pathname = `/app${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (url.pathname.startsWith('/app')) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      const loginUrl = url.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', url.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}
