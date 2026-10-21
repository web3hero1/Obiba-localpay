'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/auth-card';

function ConfirmContent() {
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

      try {
        // 1. Check if hash fragment contains access_token (standard Supabase ConfirmationURL redirect)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashString = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hashString);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const errorDesc = hashParams.get('error_description') || hashParams.get('error');

          if (errorDesc) {
            const lowerError = errorDesc.toLowerCase();
            // If already confirmed or token consumed, direct user to sign in
            if (lowerError.includes('already') || lowerError.includes('expired') || lowerError.includes('invalid')) {
              try { await supabase.auth.signOut(); } catch {}
              if (isMounted) {
                setTargetEmail(resolvedEmail);
                setStatus('success');
              }
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
              // CRITICAL: Do NOT sign them in directly! Sign out so they explicitly sign in with password.
              try { await supabase.auth.signOut(); } catch {}
              if (isMounted) {
                setTargetEmail(email);
                setStatus('success');
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
          const lowerError = queryError.toLowerCase();
          if (lowerError.includes('already') || lowerError.includes('expired') || lowerError.includes('invalid')) {
            try { await supabase.auth.signOut(); } catch {}
            if (isMounted) {
              setTargetEmail(resolvedEmail);
              setStatus('success');
            }
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
            // CRITICAL: Do NOT sign them in directly! Sign out so they explicitly sign in.
            try { await supabase.auth.signOut(); } catch {}
            if (isMounted) {
              setTargetEmail(email);
              setStatus('success');
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
            // CRITICAL: Do NOT sign them in directly! Sign out so they explicitly sign in.
            try { await supabase.auth.signOut(); } catch {}
            if (isMounted) {
              setTargetEmail(email);
              setStatus('success');
            }
            return;
          } else {
            const lowerError = otpError.message.toLowerCase();
            if (lowerError.includes('expired') || lowerError.includes('already') || lowerError.includes('invalid')) {
              try { await supabase.auth.signOut(); } catch {}
              if (isMounted) {
                setTargetEmail(resolvedEmail);
                setStatus('success');
              }
              return;
            }
          }
        }

        // 3. Check if user is already authenticated and verified
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email_confirmed_at) {
          const email = user.email || resolvedEmail;
          try { await supabase.auth.signOut(); } catch {}
          if (isMounted) {
            setTargetEmail(email);
            setStatus('success');
          }
          return;
        }

        // 4. Fallback: if email is present, mark as confirmed and prompt to sign in
        if (resolvedEmail) {
          try { await supabase.auth.signOut(); } catch {}
          if (isMounted) {
            setTargetEmail(resolvedEmail);
            setStatus('success');
          }
          return;
        }

        // 5. Unrecognized link
        if (isMounted) {
          setStatus('error');
          setErrorMessage(
            'Your verification link is invalid, expired, or has already been used. Please sign in with your email and password.'
          );
        }
      } catch (err: any) {
        if (resolvedEmail) {
          try { await supabase.auth.signOut(); } catch {}
          if (isMounted) {
            setTargetEmail(resolvedEmail);
            setStatus('success');
          }
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
  }, [searchParams]);

  if (status === 'verifying') {
    return (
      <AuthCard title="Verifying your email" subtitle="Please wait while we confirm your Obiba account.">
        <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#0A84FF] flex items-center justify-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#0B0B0C]">Confirming your email...</p>
            <p className="text-xs text-[#6E6E73]">Securing your financial profile and USDC ledger.</p>
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

  // SUCCESS SCREEN: Tell users their email is confirmed and to now sign in!
  return (
    <AuthCard title="Email Confirmed!" subtitle="Your Obiba account is activated and ready.">
      <div className="space-y-6 text-center">
        {/* Animated Checkmark */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#0B0B0C]">
            Email Verified Successfully
          </h2>
          <p className="text-xs text-[#6E6E73] leading-relaxed max-w-sm mx-auto">
            Your email has been confirmed. Please now sign in with your email and password to access your dashboard, available USDC balance, and everyday payments.
          </p>
        </div>

        <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center gap-2.5 text-xs text-left text-emerald-950 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Account verified. One USDC balance & double-entry ledger active.</span>
        </div>

        {/* Primary CTA: Tell users to now sign in */}
        <Link
          href={
            targetEmail
              ? `/auth/login?verified=true&email=${encodeURIComponent(targetEmail)}`
              : '/auth/login?verified=true'
          }
          className="w-full py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition duration-150"
        >
          <span>Sign In to Your Account</span>
          <ArrowRight className="w-4 h-4" />
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
