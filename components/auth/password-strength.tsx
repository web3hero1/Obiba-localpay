import React from 'react';
import { Check, X } from 'lucide-react';
import { evaluatePasswordStrength } from '@/lib/validations/auth';

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const { score, hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial, label } =
    evaluatePasswordStrength(password);

  const getMeterColor = (index: number) => {
    if (index >= score) return 'bg-[#E5E5EA]';
    if (score === 1) return 'bg-rose-500';
    if (score === 2) return 'bg-amber-500';
    if (score === 3) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getLabelColor = () => {
    if (score <= 1) return 'text-rose-600';
    if (score === 2) return 'text-amber-600';
    if (score === 3) return 'text-blue-600';
    return 'text-emerald-600';
  };

  return (
    <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
      {/* 4-segment Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[#6E6E73] font-medium">Password strength</span>
          <span className={`font-bold ${getLabelColor()}`}>{label}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          <div className={`rounded-full transition-all duration-300 ${getMeterColor(0)}`} />
          <div className={`rounded-full transition-all duration-300 ${getMeterColor(1)}`} />
          <div className={`rounded-full transition-all duration-300 ${getMeterColor(2)}`} />
          <div className={`rounded-full transition-all duration-300 ${getMeterColor(3)}`} />
        </div>
      </div>

      {/* Criteria Checklist */}
      <div className="grid grid-cols-2 gap-1.5 text-xs text-[#6E6E73] pt-1">
        <div className="flex items-center gap-1.5">
          {hasMinLength ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full border border-[#E5E5EA] flex items-center justify-center shrink-0 text-[9px] text-[#6E6E73]">•</span>
          )}
          <span className={hasMinLength ? 'text-[#0B0B0C] font-medium' : ''}>12+ characters</span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasUppercase ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full border border-[#E5E5EA] flex items-center justify-center shrink-0 text-[9px] text-[#6E6E73]">•</span>
          )}
          <span className={hasUppercase ? 'text-[#0B0B0C] font-medium' : ''}>Uppercase letter</span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasLowercase ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full border border-[#E5E5EA] flex items-center justify-center shrink-0 text-[9px] text-[#6E6E73]">•</span>
          )}
          <span className={hasLowercase ? 'text-[#0B0B0C] font-medium' : ''}>Lowercase letter</span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasNumber && hasSpecial ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full border border-[#E5E5EA] flex items-center justify-center shrink-0 text-[9px] text-[#6E6E73]">•</span>
          )}
          <span className={hasNumber && hasSpecial ? 'text-[#0B0B0C] font-medium' : ''}>Number & symbol</span>
        </div>
      </div>
    </div>
  );
}
