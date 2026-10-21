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

  useEffect(() => {
    let isMounted = true;

    async function handleAuth() {
      const supabase = createClient();

      try {
        // 1. Check if hash fragment contains access_token (standard Supabase ConfirmationURL redirect)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashString = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hashString);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const errorDesc = hashParams.get('error_description') || hashParams.get('error');

          if (errorDesc) {
            if (isMounted) {
              setStatus('error');
              setErrorMessage(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
            }
            return;
          }

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!sessionError) {
              if (isMounted) {
                setStatus('success');
                router.push('/auth/verified');
              }
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
          if (isMounted) {
            setStatus('error');
            setErrorMessage(decodeURIComponent(queryError.replace(/\+/g, ' ')));
          }
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError) {
            if (isMounted) {
              setStatus('success');
              if (type === 'recovery') {
                router.push('/auth/reset-password');
              } else {
                router.push('/auth/verified');
              }
            }
            return;
          }
        }

        if (tokenHash) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });

          if (!otpError) {
            if (isMounted) {
              setStatus('success');
              if (type === 'recovery') {
                router.push('/auth/reset-password');
              } else {
                router.push('/auth/verified');
              }
            }
            return;
          }
        }

        // 3. Check if user is already authenticated and verified in session
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && user.email_confirmed_at) {
          if (isMounted) {
            setStatus('success');
            router.push('/auth/verified');
          }
          return;
        }

        // 4. Fallback if no valid token or session detected
        if (isMounted) {
          setStatus('error');
          setErrorMessage(
            'Your verification link is invalid, expired, or has already been used. Please sign in or request a new link.'
          );
        }
      } catch (err: any) {
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
            <p className="text-sm font-semibold text-[#0B0B0C]">Confirming your credentials...</p>
            <p className="text-xs text-[#6E6E73]">Securing your financial profile and USDC ledger.</p>
          </div>
        </div>
      </AuthCard>
    );
  }

  if (status === 'error') {
    return (
      <AuthCard title="Verification Notice" subtitle="We could not complete email verification with this link.">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 text-left">
            {errorMessage}
          </div>

          <div className="space-y-2 pt-2">
            <Link
              href="/auth/login"
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
    <AuthCard title="Account Verified" subtitle="Your Obiba account is activated.">
      <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold text-[#0B0B0C]">Redirecting to your dashboard...</p>
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
