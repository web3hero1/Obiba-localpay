'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordStrengthMeter } from '@/components/auth/password-strength';
import { signupSchema, normalizeGhanaPhoneNumber } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    // 1. Client-side Zod validation
    const result = signupSchema.safeParse({
      fullName,
      phoneNumber,
      email,
      password,
    });

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
      const normalizedPhone = normalizeGhanaPhoneNumber(phoneNumber);

      // Call Supabase Auth signUp with metadata and email confirmation redirect
      const { data, error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          data: {
            full_name: result.data.fullName,
            phone_number: normalizedPhone,
            country_code: 'GH',
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm?email=${encodeURIComponent(result.data.email)}`,
        },
      });

      if (error) {
        // Handle existing account error
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || error.status === 422) {
          setServerError('An account with this email address already exists. Please sign in or reset your password.');
        } else {
          setServerError(error.message || 'Unable to create account. Please check your details and try again.');
        }
        setIsLoading(false);
        return;
      }

      // Supabase anti-enumeration detection: If email already exists, identities is an empty array
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setServerError('An account with this email address already exists. Please sign in or reset your password.');
        setIsLoading(false);
        return;
      }

      // Success -> Redirect to Check Your Email screen with encoded email
      const encodedEmail = encodeURIComponent(result.data.email);
      router.push(`/auth/check-email?email=${encodedEmail}`);
    } catch (err: any) {
      console.error('Signup error:', err);
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
      title="Create your Obiba account"
      subtitle="Get started with your everyday money account."
      footer={
        <div className="text-center text-xs text-[#6E6E73] font-medium space-y-3">
          <div>
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#0A84FF] font-bold hover:underline">
              Sign In
            </Link>
          </div>
          <p className="text-[11px] leading-relaxed text-[#6E6E73]">
            By creating an account, you agree to Obiba's{' '}
            <a href="#" className="underline hover:text-[#0B0B0C]">Terms of Service</a> and{' '}
            <a href="#" className="underline hover:text-[#0B0B0C]">Privacy Policy</a>.
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="font-medium leading-relaxed">{serverError}</div>
              {serverError.includes('already exists') && (
                <div>
                  <Link
                    href={`/auth/login?email=${encodeURIComponent(email)}`}
                    className="inline-flex items-center gap-1 font-bold text-[#0A84FF] hover:underline text-xs"
                  >
                    <span>Click here to Sign In</span>
                    <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full Name */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#0B0B0C]">Full Legal Name</label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
            autoComplete="name"
            className={`w-full px-4 py-3 rounded-2xl border text-sm text-[#0B0B0C] placeholder-[#6E6E73]/60 focus:outline-none transition ${
              errors.fullName
                ? 'border-rose-500 bg-rose-50/30 focus:border-rose-500'
                : 'border-[#E5E5EA] bg-[#F7F8FA]/50 focus:border-[#0A84FF] focus:bg-white'
            }`}
          />
          {errors.fullName && <p className="text-xs text-rose-600 font-medium">{errors.fullName}</p>}
        </div>

        {/* Ghana Phone Number with +233 prefix */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#0B0B0C]">Phone Number</label>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 px-3 py-3 rounded-2xl border border-[#E5E5EA] bg-white text-xs font-bold text-[#0B0B0C] select-none shrink-0 shadow-sm">
              <span>🇬🇭</span>
              <span>+233</span>
            </div>
            <input
              type="tel"
              placeholder="24 123 4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={isLoading}
              autoComplete="tel"
              className={`w-full px-4 py-3 rounded-2xl border text-sm text-[#0B0B0C] placeholder-[#6E6E73]/60 focus:outline-none transition ${
                errors.phoneNumber
                  ? 'border-rose-500 bg-rose-50/30 focus:border-rose-500'
                  : 'border-[#E5E5EA] bg-[#F7F8FA]/50 focus:border-[#0A84FF] focus:bg-white'
              }`}
            />
          </div>
          {errors.phoneNumber && <p className="text-xs text-rose-600 font-medium">{errors.phoneNumber}</p>}
        </div>

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
          <label className="block text-xs font-bold text-[#0B0B0C]">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
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

          {/* Dynamic Requirement & Strength Meter */}
          <PasswordStrengthMeter password={password} />
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
              <span>Creating your account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}
