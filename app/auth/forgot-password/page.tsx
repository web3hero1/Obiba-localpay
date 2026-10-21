'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ArrowRight, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { forgotPasswordSchema } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setErrors({ email: result.error.issues[0]?.message || 'Please enter a valid email' });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      });

      // Always show success screen to prevent email enumeration attacks
      if (error && !error.message.includes('rate limit')) {
        console.warn('Password recovery error:', error.message);
      }

      setIsSubmitted(true);
    } catch {
      setServerError('A connection error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="Password reset instructions have been sent."
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
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#0A84FF] flex items-center justify-center mx-auto shadow-sm">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-[#0B0B0C] font-semibold">
              If an account exists for <span className="text-[#0A84FF]">{email}</span>, you will receive an email shortly.
            </p>
            <p className="text-xs text-[#6E6E73] leading-relaxed max-w-sm mx-auto">
              Please check your inbox and click the link to set a new password. The link will expire in 1 hour.
            </p>
          </div>

          <Link
            href="/auth/login"
            className="w-full py-3 px-4 rounded-2xl border border-[#E5E5EA] bg-white hover:bg-gray-50 text-xs font-bold text-[#0B0B0C] flex items-center justify-center gap-2 transition"
          >
            <span>Return to Sign In</span>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email address, and we'll send instructions to reset your password."
      footer={
        <div className="text-center text-xs text-[#6E6E73] font-medium">
          Remembered your password?{' '}
          <Link href="/auth/login" className="text-[#0A84FF] font-bold hover:underline">
            Sign In
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#0B0B0C]">Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="email"
            className={`w-full px-4 py-3 rounded-2xl border text-sm text-[#0B0B0C] placeholder-[#6E6E73]/60 focus:outline-none transition ${
              errors.email
                ? 'border-rose-500 bg-rose-50/30 focus:border-rose-500'
                : 'border-[#E5E5EA] bg-[#F7F8FA]/50 focus:border-[#0A84FF] focus:bg-white'
            }`}
          />
          {errors.email && <p className="text-xs text-rose-600 font-medium">{errors.email}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] disabled:opacity-60 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition duration-150"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending reset link...</span>
            </>
          ) : (
            <>
              <span>Send Reset Link</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}
