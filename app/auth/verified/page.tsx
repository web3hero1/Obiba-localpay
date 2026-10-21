import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';

export default function VerifiedSuccessPage() {
  return (
    <AuthCard
      title="Email Verified"
      subtitle="Your Obiba account is activated and ready."
    >
      <div className="space-y-6 text-center">
        {/* Animated Checkmark */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-[#0B0B0C]">
            Welcome to Obiba!
          </h2>
          <p className="text-xs text-[#6E6E73] leading-relaxed max-w-sm mx-auto">
            Your email has been verified. You now have access to your unified USDC balance, everyday bill payments, and local money transfers.
          </p>
        </div>

        <div className="p-3 bg-[#F7F8FA] rounded-2xl border border-[#E5E5EA] flex items-center gap-2.5 text-xs text-left text-[#0B0B0C]">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Double-entry ledger account initialized and active</span>
        </div>

        <Link
          href="/dashboard"
          className="w-full py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition duration-150"
        >
          <span>Continue to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </AuthCard>
  );
}
