'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { loginSchema } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';
  const urlError = searchParams.get('error');

  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(urlError);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (urlError) {
      setServerError(urlError);
    }
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    // 1. Zod validation
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });

      if (error) {
        // Check if unconfirmed email
        if (error.message.toLowerCase().includes('email not confirmed')) {
          router.push(`/auth/check-email?email=${encodeURIComponent(result.data.email)}`);
          return;
        }

        // Generic secure error message to prevent enumeration
        if (error.message.includes('Invalid login credentials')) {
          setServerError('Invalid email address or password. Please verify your credentials.');
        } else {
          setServerError(error.message || 'Unable to sign in. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      // Check user session & email confirmation
      if (data.user && !data.user.email_confirmed_at) {
        router.push(`/auth/check-email?email=${encodeURIComponent(result.data.email)}`);
        return;
      }

      // Success -> Give cookie jar 150ms to flush, then execute full page navigation
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 150);
    } catch (err: any) {
      console.error('Login error:', err);
      const isMissingConfig = !process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (isMissingConfig) {
        setServerError('Obiba authentication service configuration is missing. Please contact support.');
      } else {
        setServerError(err.message || 'A network error occurred while communicating with the Obiba authentication service. Please try again.');
      }
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Obiba account."
      footer={
        <div className="text-center text-xs text-[#6E6E73] font-medium">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-[#0A84FF] font-bold hover:underline">
            Create Account
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

        {/* Email Address */}
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

        {/* Password */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold text-[#0B0B0C]">Password</label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-[#0A84FF] font-bold hover:underline"
              tabIndex={-1}
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              className={`w-full px-4 py-3 pr-11 rounded-2xl border text-sm text-[#0B0B0C] placeholder-[#6E6E73]/60 focus:outline-none transition ${
                errors.password
                  ? 'border-rose-500 bg-rose-50/30 focus:border-rose-500'
                  : 'border-[#E5E5EA] bg-[#F7F8FA]/50 focus:border-[#0A84FF] focus:bg-white'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3.5 text-[#6E6E73] hover:text-[#0B0B0C] p-1 rounded-md"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-rose-600 font-medium">{errors.password}</p>}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] disabled:opacity-60 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition duration-150"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0A84FF]" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
