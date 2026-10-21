'use client';

import React, { useState } from 'react';
import {
  X,
  Zap,
  Smartphone,
  Wifi,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface BillsModalProps {
  isOpen: boolean;
  type: 'BILLS' | 'AIRTIME' | 'DATA';
  onClose: () => void;
  onBalanceUpdated: () => void;
  availableUsdc: number;
}

export function BillsModal({
  isOpen,
  type,
  onClose,
  onBalanceUpdated,
  availableUsdc,
}: BillsModalProps) {
  const [meterNumber, setMeterNumber] = useState<string>('482019-2041');
  const [phoneNumber, setPhoneNumber] = useState<string>('0241234567');
  const [provider, setProvider] = useState<'MTN' | 'TELECEL' | 'AT'>('MTN');
  const [amountGhs, setAmountGhs] = useState<string>('50');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  if (!isOpen) return null;

  const requiredUsdc = ((parseFloat(amountGhs) || 0) + 0.5) / 15.25;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (type === 'BILLS') {
        const res = await fetch('/api/bills/ecg/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meterNumber,
            amountGhs: parseFloat(amountGhs) || 50,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Electricity recharge failed');
        }
        const data = await res.json();
        setSuccessData(data);
      } else {
        const res = await fetch('/api/bills/recharge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: type === 'AIRTIME' ? 'AIRTIME' : 'DATA',
            provider,
            phone: phoneNumber,
            amountGhs: parseFloat(amountGhs) || 20,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Recharge failed');
        }
        const data = await res.json();
        setSuccessData(data);
      }
      onBalanceUpdated();
    } catch (err: any) {
      setError(err.message || 'Payment failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
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
              {type === 'BILLS' ? <Zap className="w-4 h-4" /> : type === 'AIRTIME' ? <Smartphone className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0B0B0C] leading-none">
                {type === 'BILLS' ? 'ECG Electricity Prepaid' : type === 'AIRTIME' ? 'Buy Airtime' : 'Mobile Data Bundle'}
              </h2>
              <p className="text-[11px] text-[#6E6E73] mt-1 font-medium">
                Instant settlement from your One USDC balance
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

          {successData ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  {type === 'BILLS' ? 'Electricity Token Generated' : 'Recharge Successful'}
                </h3>
                {type === 'BILLS' && successData.fulfillment?.token && (
                  <div className="mt-2 p-3 bg-white border border-emerald-200 rounded-2xl font-mono text-sm font-extrabold text-[#0B0B0C] tracking-wider select-all">
                    {successData.fulfillment.token}
                  </div>
                )}
                <p className="text-xs text-emerald-800 mt-1">
                  {type === 'BILLS'
                    ? `Units: ${successData.fulfillment?.kwhUnits} kWh. Enter digits into your meter CIU.`
                    : `Credit of GH₵${amountGhs} sent to ${phoneNumber}.`}
                </p>
              </div>
              <div className="text-[11px] text-[#6E6E73]">
                Debited: <strong className="text-[#0B0B0C]">${successData.debitedUsdcDisplay} USDC</strong>
              </div>
              <button
                onClick={handleReset}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-4">
              {type === 'BILLS' ? (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#0B0B0C]">ECG Meter Number</label>
                  <input
                    type="text"
                    value={meterNumber}
                    onChange={(e) => setMeterNumber(e.target.value)}
                    placeholder="482019-2041"
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-[#E5E5EA] bg-[#F7F8FA]/50 text-sm font-mono text-[#0B0B0C] focus:outline-none focus:border-[#0A84FF]"
                  />
                  <div className="text-[10px] text-[#6E6E73]">Customer: Kwame Mensah (East Legon)</div>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#0B0B0C]">Select Telecom Network</label>
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
                          {prov === 'MTN' ? 'MTN' : prov === 'TELECEL' ? 'Telecel' : 'AT'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#0B0B0C]">Recipient Phone</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0241234567"
                      required
                      className="w-full px-4 py-3 rounded-2xl border border-[#E5E5EA] bg-[#F7F8FA]/50 text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0A84FF]"
                    />
                  </div>
                </>
              )}

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
                  min="5"
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
                    <span>Processing Payment...</span>
                  </>
                ) : requiredUsdc > availableUsdc ? (
                  <span>Insufficient USDC Balance</span>
                ) : (
                  <>
                    <span>Pay GH₵{amountGhs} with One USDC</span>
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
