import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  const supabase = createClient();

  // 1. PKCE Code Exchange flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      return NextResponse.redirect(`${origin}/auth/verified`);
    }
  }

  // 2. Token Hash verification flow (Supabase Auth email confirmation)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      return NextResponse.redirect(`${origin}/auth/verified`);
    }
  }

  // 3. Fallback / error: Link expired, invalid or already verified
  return NextResponse.redirect(
    `${origin}/auth/login?error=${encodeURIComponent(
      'Your verification link is invalid, expired, or has already been used. Please sign in or request a new link.'
    )}`
  );
}
