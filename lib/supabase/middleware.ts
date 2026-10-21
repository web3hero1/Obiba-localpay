import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard against missing Supabase credentials
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
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: '',
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value: '',
          ...options,
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Root redirect
  if (pathname === '/') {
    if (user && user.email_confirmed_at) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // 2. Protect /dashboard and internal API routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    // Block access if email is not confirmed
    if (!user.email_confirmed_at) {
      const checkEmailUrl = new URL('/auth/check-email', request.url);
      if (user.email) checkEmailUrl.searchParams.set('email', user.email);
      return NextResponse.redirect(checkEmailUrl);
    }
  }

  // 3. Redirect authenticated & verified users away from auth pages
  if (user && user.email_confirmed_at) {
    if (pathname === '/auth' || pathname === '/auth/login' || pathname === '/auth/signup') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}
