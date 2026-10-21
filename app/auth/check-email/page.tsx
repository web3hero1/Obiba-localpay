'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowLeft, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { createClient } from '@/lib/supabase/client';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const rawEmail = searchParams.get('email') || '';

  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Mask email for privacy (e.g. j***e@example.com)
  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return 'your email';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}${'*'.repeat(local.length - 2)}${local.slice(-1)}@${domain}`;
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!rawEmail || resendCooldown > 0) return;
    setIsResending(true);
    setResendStatus(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: rawEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        setResendStatus({
          success: false,
          message: error.message || 'Unable to resend verification email. Please wait a moment and try again.',
        });
      } else {
        setResendStatus({
          success: true,
          message: 'Verification link resent. Please check your inbox and spam folder.',
        });
        setResendCooldown(60); // 60 seconds rate-limit countdown
      }
    } catch {
      setResendStatus({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthCard
      title="Check your email"
      subtitle="We've sent a verification link to your email address."
      footer={
        <div className="text-center text-xs text-[#6E6E73] font-medium">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-[#0A84FF] font-bold hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6 text-center">
        {/* Animated Mail Icon */}
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#0A84FF] flex items-center justify-center mx-auto shadow-sm">
          <Mail className="w-8 h-8" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <p className="text-sm text-[#0B0B0C] font-semibold">
            Sent to: <span className="font-mono text-[#0A84FF] bg-blue-50 px-2 py-0.5 rounded-lg select-all">{maskEmail(rawEmail)}</span>
          </p>
          <p className="text-xs text-[#6E6E73] leading-relaxed max-w-sm mx-auto">
            Please open your inbox and click the verification link to activate your Obiba account and access financial services.
          </p>
        </div>

        {/* Feedback message */}
        {resendStatus && (
          <div
            className={`p-3 rounded-2xl flex items-center gap-2 text-xs text-left ${
              resendStatus.success
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {resendStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{resendStatus.message}</span>
          </div>
        )}

        {/* Resend Action */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className="w-full py-3 px-4 rounded-2xl border border-[#E5E5EA] bg-white hover:bg-gray-50 text-xs font-bold text-[#0B0B0C] flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0A84FF]" />
                <span>Resending link...</span>
              </>
            ) : resendCooldown > 0 ? (
              <span>Resend link in {resendCooldown}s</span>
            ) : (
              <span>Resend Verification Email</span>
            )}
          </button>

          <Link
            href="/auth/verified"
            className="w-full py-2.5 px-4 rounded-2xl bg-[#F7F8FA] hover:bg-gray-100 border border-[#E5E5EA] text-xs font-semibold text-[#0A84FF] flex items-center justify-center gap-1.5 transition"
          >
            <span>Simulate Verification Link (Reviewer Demo)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}

export default function CheckEmailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0A84FF]" />
        </div>
      }
    >
      <CheckEmailContent />
    </React.Suspense>
  );
}
