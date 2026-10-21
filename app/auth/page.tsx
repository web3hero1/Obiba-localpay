import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Globe2 } from 'lucide-react';
import { ObibaLogo } from '@/components/logo';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-between items-center p-5 sm:p-8">
      {/* Top Bar with Logo */}
      <header className="w-full max-w-5xl flex justify-between items-center py-2">
        <ObibaLogo size="md" />
        <Link
          href="/auth/login"
          className="text-xs sm:text-sm font-bold text-[#0A84FF] hover:text-[#0066CC] transition px-4 py-2 rounded-full hover:bg-blue-50"
        >
          Sign In
        </Link>
      </header>

      {/* Hero Welcome Card */}
      <main className="w-full max-w-md my-auto py-8">
        <div className="bg-white border border-[#E5E5EA] rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/[0.03] space-y-6 text-center">
          
          <div className="mx-auto w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center">
            <ObibaLogo size="lg" showWordmark={false} />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-[#0B0B0C] tracking-tight">
              Your money, made simple.
            </h1>
            <p className="text-sm text-[#6E6E73] font-medium leading-relaxed max-w-xs mx-auto">
              Manage your money, make payments, and access everyday financial services.
            </p>
          </div>

          {/* Value Props */}
          <div className="py-2 border-y border-[#E5E5EA]/70 grid grid-cols-3 gap-2 text-left">
            <div className="p-2 space-y-1">
              <Zap className="w-4 h-4 text-[#0A84FF]" />
              <div className="text-[11px] font-bold text-[#0B0B0C]">Instant</div>
              <div className="text-[10px] text-[#6E6E73]">Everyday local bills & payouts</div>
            </div>
            <div className="p-2 space-y-1 border-x border-[#E5E5EA]/70">
              <Globe2 className="w-4 h-4 text-[#0A84FF]" />
              <div className="text-[11px] font-bold text-[#0B0B0C]">Global</div>
              <div className="text-[10px] text-[#6E6E73]">Single digital dollar balance</div>
            </div>
            <div className="p-2 space-y-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <div className="text-[11px] font-bold text-[#0B0B0C]">Secure</div>
              <div className="text-[10px] text-[#6E6E73]">Double-entry ledger core</div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="space-y-3 pt-2">
            <Link
              href="/auth/signup"
              className="w-full py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition duration-150"
            >
              <span>Continue with Email</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="text-xs text-[#6E6E73] font-medium">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-[#0A84FF] font-bold hover:underline">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Disclosures */}
      <footer className="w-full max-w-md text-center text-xs text-[#6E6E73] pb-2">
        <p>By continuing, you agree to Obiba's Terms of Service and Privacy Policy.</p>
      </footer>
    </div>
  );
}
