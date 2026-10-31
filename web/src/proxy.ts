import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? 'app.shoppingmate.shop';

// Login cookies belong to one host, and sign-in links go to the canonical
// domain — so a visitor on the old vercel.app address got signed in on www
// and then asked to sign in again on vercel.app. Page visits there move to the
// canonical domain; the widget script, API, webhooks and files stay put
// (brands' installed snippets and payment webhooks still use that address).
// Only a real https site address counts (a dev .env may set http://localhost).
const CANONICAL_ORIGIN = /^https:\/\//.test(process.env.NEXT_PUBLIC_APP_URL ?? '')
  ? (process.env.NEXT_PUBLIC_APP_URL as string)
  : 'https://www.shoppingmate.shop';
const LEGACY_HOSTS = new Set(['shoppingmate-web.vercel.app', 'shoppingmate.shop']);

function canonicalRedirect(req: NextRequest): NextResponse | null {
  const { hostname, pathname, search } = req.nextUrl;
  if (!LEGACY_HOSTS.has(hostname)) return null;
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  if (pathname.startsWith('/api') || pathname.startsWith('/widget') || pathname.startsWith('/_next')) return null;
  if (/\.[a-z0-9]+$/i.test(pathname)) return null; // static files (images, icons, scripts)
  const target = new URL(`${pathname}${search}`, CANONICAL_ORIGIN);
  if (target.hostname === hostname) return null;
  return NextResponse.redirect(target, 308);
}

export async function proxy(req: NextRequest) {
  const moved = canonicalRedirect(req);
  if (moved) return moved;
  const url = req.nextUrl.clone();
  // Use hostname from the parsed URL (works in both prod and vitest environments).
  // req.headers.get('host') is null when NextRequest is constructed from a URL
  // string without explicit headers (e.g. in unit tests).
  const hostname = req.nextUrl.hostname;

  // Build mutated request headers carrying x-pathname so server components
  // (e.g. the dashboard layout) can read the current route without relying on
  // the unavailable request object.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', url.pathname);

  const isAppHost =
    hostname === APP_HOST ||
    hostname === APP_HOST.split(':')[0] ||
    hostname.startsWith('app.localhost');

  if (
    isAppHost &&
    !url.pathname.startsWith('/app') &&
    !url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/admin') &&
    !url.pathname.startsWith('/login') &&
    !url.pathname.startsWith('/signup') &&
    !url.pathname.startsWith('/verify')
  ) {
    url.pathname = `/app${url.pathname === '/' ? '' : url.pathname}`;
    const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    // Marker header so the subdomain→/app rewrite is observable (in tests and
    // in prod debugging). NextResponse.rewrite only sets Next's internal
    // x-middleware-rewrite, which isn't a stable contract to assert against.
    res.headers.set('x-proxy-rewrite', url.pathname);
    return res;
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

  return NextResponse.next({ request: { headers: requestHeaders } });
}
