'use client';

import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  Loader2,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';

interface SendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated: () => void;
  availableUsdc: number;
}

export function SendMoneyModal({
  isOpen,
  onClose,
  onBalanceUpdated,
  availableUsdc,
}: SendMoneyModalProps) {
  const [provider, setProvider] = useState<'MTN' | 'TELECEL' | 'AT'>('MTN');
  const [recipientPhone, setRecipientPhone] = useState<string>('0559876543');
  const [amountGhs, setAmountGhs] = useState<string>('50');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);

  if (!isOpen) return null;

  const requiredUsdc = (parseFloat(amountGhs) || 0) / 15.25;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/payouts/momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          phone: recipientPhone,
          amountGhs: parseFloat(amountGhs) || 50,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Payout failed. Please verify balance and recipient.');
      }

      const result = await res.json();
      setSuccessResult(result);
      onBalanceUpdated();
    } catch (err: any) {
      setError(err.message || 'An error occurred during transfer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSuccessResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5E5EA] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E5EA] flex justify-between items-center bg-[#F7F8FA]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0A84FF] flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0B0B0C] leading-none">
                {successResult ? 'Transfer Sent!' : 'Send Money / Payout'}
              </h2>
              <p className="text-[11px] text-[#6E6E73] mt-1 font-medium">
                Instant Mobile Money payout (Ghana Rails)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white border border-transparent hover:border-[#E5E5EA] text-[#6E6E73] hover:text-[#0B0B0C] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successResult ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950">Mobile Money Sent</h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  GH₵{successResult.amountGhs.toFixed(2)} sent to {successResult.recipientPhone} ({successResult.provider}).
                </p>
              </div>
              <div className="text-[11px] text-[#6E6E73]">
                Debited: <strong className="text-[#0B0B0C]">${successResult.debitedUsdcDisplay} USDC</strong>
              </div>
              <button
                onClick={handleReset}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Provider */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#0B0B0C]">Payout Rail</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['MTN', 'TELECEL', 'AT'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setProvider(prov)}
                      className={`p-2.5 rounded-2xl border text-xs font-bold text-center transition ${
                        provider === prov
                          ? 'border-[#0A84FF] bg-blue-50 text-[#0A84FF]'
                          : 'border-[#E5E5EA] bg-white text-[#6E6E73] hover:border-[#0A84FF]'
                      }`}
                    >
                      {prov === 'MTN' ? 'MTN MoMo' : prov === 'TELECEL' ? 'Telecel Cash' : 'AT Money'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Phone */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#0B0B0C]">Recipient Phone</label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="0559876543"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-[#E5E5EA] bg-[#F7F8FA]/50 text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0A84FF]"
                />
              </div>

              {/* Amount in GHS */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-[#0B0B0C]">Amount (GH₵)</label>
                  <span className="text-[10px] text-[#6E6E73]">
                    Available: ${availableUsdc.toFixed(2)} USDC
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={amountGhs}
                  onChange={(e) => setAmountGhs(e.target.value)}
                  placeholder="50"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-[#E5E5EA] bg-[#F7F8FA]/50 text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0A84FF]"
                />
                <div className="text-[11px] text-[#6E6E73] font-medium pt-0.5 flex justify-between">
                  <span>Debited from balance:</span>
                  <strong className="text-[#0A84FF]">≈ ${requiredUsdc.toFixed(2)} USDC</strong>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isLoading || requiredUsdc > availableUsdc}
                className="w-full py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] disabled:opacity-50 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Settling MoMo Payout...</span>
                  </>
                ) : requiredUsdc > availableUsdc ? (
                  <span>Insufficient USDC Balance</span>
                ) : (
                  <>
                    <span>Send GH₵{amountGhs} via {provider}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
