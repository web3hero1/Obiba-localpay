import React from 'react';
import { ObibaLogo } from '@/components/logo';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Brand Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <ObibaLogo size="lg" />
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-white border border-[#E5E5EA] rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/[0.03]">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-[#0B0B0C] tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-[#6E6E73] mt-1.5 font-medium leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Form Body */}
        {children}

        {/* Optional Footer Links */}
        {footer && <div className="mt-6 pt-5 border-t border-[#E5E5EA]/80">{footer}</div>}
      </div>

      {/* Global Bottom Security Disclosures */}
      <div className="mt-8 text-center text-xs text-[#6E6E73]">
        <span>Protected by bank-grade encryption · Obiba Financial Network</span>
      </div>
    </div>
  );
}
