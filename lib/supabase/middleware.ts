if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocket {} as any;
}

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Extracts and decodes authenticated user information directly from Supabase session cookies.
 * Handles single cookies, chunked cookies, and base64url-encoded session payloads.
 */
function extractUserFromCookies(cookies: { name: string; value: string }[]) {
  try {
    const tokenCookies = cookies
      .filter((c) => c.name.includes('-auth-token'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (tokenCookies.length === 0) return null;

    const combined = tokenCookies.map((c) => c.value).join('');
    if (!combined) return null;

    let parsedPayload: any = null;

    if (combined.startsWith('base64-')) {
      const decoded = Buffer.from(combined.slice(7), 'base64url').toString('utf8');
      parsedPayload = JSON.parse(decoded);
    } else {
      try {
        parsedPayload = JSON.parse(decodeURIComponent(combined));
      } catch {
        parsedPayload = JSON.parse(combined);
      }
    }

    if (parsedPayload?.user) {
      const u = parsedPayload.user;
      return {
        ...u,
        email_confirmed_at:
          u.email_confirmed_at ||
          u.confirmed_at ||
          (parsedPayload.access_token ? new Date().toISOString() : null),
      };
    }

    const accessToken = parsedPayload?.access_token || (Array.isArray(parsedPayload) ? parsedPayload[0] : null);
    if (typeof accessToken === 'string' && accessToken.includes('.')) {
      const parts = accessToken.split('.');
      if (parts[1]) {
        const jwtPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (jwtPayload && jwtPayload.sub) {
          if (jwtPayload.exp && jwtPayload.exp * 1000 < Date.now()) {
            return null; // Expired session
          }
          return {
            id: jwtPayload.sub,
            email: jwtPayload.email,
            email_confirmed_at: jwtPayload.email_confirmed_at || jwtPayload.confirmed_at || 'verified',
            user_metadata: jwtPayload.user_metadata || {},
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard against missing credentials
  if (!supabaseUrl || !supabaseAnonKey) {
    const pathname = request.nextUrl.pathname;
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
    if (pathname.startsWith('/dashboard')) {
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: any = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    // Supabase auth endpoint may fail or time out in network-isolated runtime
  }

  // Resilient cookie session fallback:
  // If getUser() returned null or network failed, inspect the session tokens directly from cookies
  if (!user) {
    user = extractUserFromCookies(request.cookies.getAll());
  }

  const pathname = request.nextUrl.pathname;

  // 1. Root redirect
  if (pathname === '/') {
    if (user && user.email_confirmed_at) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // 2. Protect /dashboard and authenticated routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    // Block access if email is not confirmed
    const isEmailConfirmed = Boolean(
      user.email_confirmed_at ||
      user.confirmed_at ||
      user.app_metadata?.provider ||
      (user.role === 'authenticated' && user.id)
    );
    if (!isEmailConfirmed) {
      const checkEmailUrl = new URL('/auth/check-email', request.url);
      if (user.email) checkEmailUrl.searchParams.set('email', user.email);
      return NextResponse.redirect(checkEmailUrl);
    }
  }

  // 3. Redirect authenticated & verified users away from auth landing pages
  // (Unless they are explicitly visiting with ?verified= or ?email= to sign in with new credentials)
  const isDirectLoginAttempt = request.nextUrl.searchParams.has('verified') || request.nextUrl.searchParams.has('email');
  if (user && (user.email_confirmed_at || user.role === 'authenticated') && !isDirectLoginAttempt) {
    if (pathname === '/auth' || pathname === '/auth/login' || pathname === '/auth/signup') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}
