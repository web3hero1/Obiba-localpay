'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/auth-card';

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [targetEmail, setTargetEmail] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    async function handleAuth() {
      const supabase = createClient();
      const emailFromQuery = searchParams.get('email') || '';
      let resolvedEmail = emailFromQuery;

      const redirectToLogin = async (email: string) => {
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignored
        }
        const encodedEmail = encodeURIComponent(email);
        // Immediate redirect to sign in page as requested
        window.location.replace(`/auth/login?verified=true&email=${encodedEmail}`);
      };

      try {
        // 1. Check if hash fragment contains access_token (standard Supabase ConfirmationURL redirect)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashString = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hashString);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const errorDesc = hashParams.get('error_description') || hashParams.get('error');

          if (errorDesc) {
            // If already confirmed or token consumed, direct user to sign in
            const lowerError = errorDesc.toLowerCase();
            if (lowerError.includes('already') || lowerError.includes('expired') || lowerError.includes('invalid')) {
              await redirectToLogin(resolvedEmail);
              return;
            }
            if (isMounted) {
              setStatus('error');
              setErrorMessage(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
            }
            return;
          }

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!sessionError) {
              const email = sessionData?.user?.email || resolvedEmail;
              setTargetEmail(email);
              if (isMounted) setStatus('success');
              setTimeout(() => redirectToLogin(email), 400);
              return;
            }
          }
        }

        // 2. Check query params (PKCE code or token_hash)
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
        const type = searchParams.get('type') || 'signup';
        const queryError = searchParams.get('error_description') || searchParams.get('error');

        if (queryError) {
          const lowerError = queryError.toLowerCase();
          if (lowerError.includes('already') || lowerError.includes('expired') || lowerError.includes('invalid')) {
            await redirectToLogin(resolvedEmail);
            return;
          }
          if (isMounted) {
            setStatus('error');
            setErrorMessage(decodeURIComponent(queryError.replace(/\+/g, ' ')));
          }
          return;
        }

        if (code) {
          const { data: codeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError) {
            const email = codeData?.user?.email || resolvedEmail;
            setTargetEmail(email);
            if (isMounted) setStatus('success');
            if (type === 'recovery') {
              router.push('/auth/reset-password');
            } else {
              setTimeout(() => redirectToLogin(email), 400);
            }
            return;
          }
        }

        if (tokenHash) {
          const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });

          if (!otpError) {
            const email = otpData?.user?.email || resolvedEmail;
            setTargetEmail(email);
            if (isMounted) setStatus('success');
            if (type === 'recovery') {
              router.push('/auth/reset-password');
            } else {
              setTimeout(() => redirectToLogin(email), 400);
            }
            return;
          } else {
            // If token was already used / verified, bring user to sign in
            const lowerError = otpError.message.toLowerCase();
            if (lowerError.includes('expired') || lowerError.includes('already') || lowerError.includes('invalid')) {
              await redirectToLogin(resolvedEmail);
              return;
            }
          }
        }

        // 3. Check if user is already authenticated and verified in session
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && user.email_confirmed_at) {
          const email = user.email || resolvedEmail;
          setTargetEmail(email);
          if (isMounted) setStatus('success');
          setTimeout(() => redirectToLogin(email), 400);
          return;
        }

        // 4. If an email is known from query, route to sign in
        if (resolvedEmail) {
          await redirectToLogin(resolvedEmail);
          return;
        }

        // 5. Fallback notice
        if (isMounted) {
          setStatus('error');
          setErrorMessage(
            'Your verification link is invalid, expired, or has already been used. Please sign in with your email and password.'
          );
        }
      } catch (err: any) {
        if (resolvedEmail) {
          await redirectToLogin(resolvedEmail);
          return;
        }
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'An error occurred during verification. Please try signing in.');
        }
      }
    }

    handleAuth();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  if (status === 'verifying') {
    return (
      <AuthCard title="Verifying your email" subtitle="Please wait while we confirm your Obiba account.">
        <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#0A84FF] flex items-center justify-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#0B0B0C]">Confirming your email...</p>
            <p className="text-xs text-[#6E6E73]">Preparing your sign-in to the Obiba dashboard.</p>
          </div>
        </div>
      </AuthCard>
    );
  }

  if (status === 'error') {
    return (
      <AuthCard title="Verification Notice" subtitle="We could not complete verification with this link.">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 text-left">
            {errorMessage}
          </div>

          <div className="space-y-2 pt-2">
            <Link
              href={targetEmail ? `/auth/login?email=${encodeURIComponent(targetEmail)}` : '/auth/login'}
              className="w-full py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition"
            >
              <span>Continue to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/signup"
              className="w-full py-3 px-6 bg-white hover:bg-gray-50 border border-[#E5E5EA] text-[#0B0B0C] font-semibold rounded-2xl text-xs block transition"
            >
              Create a New Account
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Email Confirmed" subtitle="Taking you to the sign in page...">
      <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#0B0B0C]">Email confirmed successfully!</p>
          <p className="text-xs text-[#6E6E73]">Redirecting to Sign In...</p>
        </div>
        <Link
          href={targetEmail ? `/auth/login?verified=true&email=${encodeURIComponent(targetEmail)}` : '/auth/login?verified=true'}
          className="text-xs text-[#0A84FF] font-bold hover:underline pt-2 block"
        >
          Click here if not redirected automatically
        </Link>
      </div>
    </AuthCard>
  );
}

export default function ConfirmPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0A84FF]" />
        </div>
      }
    >
      <ConfirmContent />
    </React.Suspense>
  );
}
