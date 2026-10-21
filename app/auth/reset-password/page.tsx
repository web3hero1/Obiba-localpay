'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordStrengthMeter } from '@/components/auth/password-strength';
import { resetPasswordSchema } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
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
      const { error } = await supabase.auth.updateUser({
        password: result.data.password,
      });

      if (error) {
        setServerError(error.message || 'Unable to reset password. Your recovery link may be expired.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/auth/login?success=Password+reset+successful.+Please+sign+in.');
      }, 2000);
    } catch {
      setServerError('A network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthCard
        title="Password Reset"
        subtitle="Your password has been successfully updated."
      >
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <p className="text-xs text-[#6E6E73]">
            Redirecting you to sign in with your new password...
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set new password"
      subtitle="Create a new strong password for your Obiba account."
      footer={
        <div className="text-center text-xs text-[#6E6E73] font-medium">
          Remember your password?{' '}
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

        {/* New Password */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#0B0B0C]">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter at least 12 characters"
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
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-rose-600 font-medium">{errors.password}</p>}
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Confirm New Password */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#0B0B0C]">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
              className={`w-full px-4 py-3 pr-11 rounded-2xl border text-sm text-[#0B0B0C] placeholder-[#6E6E73]/60 focus:outline-none transition ${
                errors.confirmPassword
                  ? 'border-rose-500 bg-rose-50/30 focus:border-rose-500'
                  : 'border-[#E5E5EA] bg-[#F7F8FA]/50 focus:border-[#0A84FF] focus:bg-white'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-3.5 text-[#6E6E73] hover:text-[#0B0B0C] p-1 rounded-md"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-rose-600 font-medium">{errors.confirmPassword}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] disabled:opacity-60 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition duration-150"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Updating password...</span>
            </>
          ) : (
            <>
              <span>Reset Password</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}
