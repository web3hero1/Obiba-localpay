'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  Zap,
  Globe2,
  Smartphone,
  Coins,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { QRCodeSVG } from '@/components/qr-code';
import { NearIntentsAsset, DepositIntent } from '@/lib/types';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated: () => void;
  userPhone?: string;
}

export function AddMoneyModal({
  isOpen,
  onClose,
  onBalanceUpdated,
  userPhone = '',
}: AddMoneyModalProps) {
  const [activeTab, setActiveTab] = useState<'crypto' | 'momo'>('crypto');
  const [environment, setEnvironment] = useState<'testnet' | 'mainnet'>('testnet');
  const [assets, setAssets] = useState<NearIntentsAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>('SOL');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('Solana Devnet');
  const [amount, setAmount] = useState<string>('1.0');
  const [quote, setQuote] = useState<any>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);

  // Intent State
  const [isCreatingIntent, setIsCreatingIntent] = useState<boolean>(false);
  const [activeIntent, setActiveIntent] = useState<DepositIntent | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // MoMo State
  const [momoProvider, setMomoProvider] = useState<'MTN' | 'TELECEL' | 'AT'>('MTN');
  const [momoAmountGhs, setMomoAmountGhs] = useState<string>('100');
  const [momoPhone, setMomoPhone] = useState<string>(userPhone || '0241234567');
  const [isMomoSubmitting, setIsMomoSubmitting] = useState<boolean>(false);
  const [momoSuccess, setMomoSuccess] = useState<boolean>(false);

  // Load assets whenever environment changes
  useEffect(() => {
    async function loadAssets() {
      try {
        const res = await fetch(`/api/crypto/assets?environment=${environment}`);
        if (res.ok) {
          const data = await res.json();
          setAssets(data.assets || []);
          const current = data.assets.find((a: NearIntentsAsset) => a.symbol === selectedAsset) || data.assets[0];
          if (current) {
            setSelectedAsset(current.symbol);
            setSelectedNetwork(current.networks[0] || '');
          }
        }
      } catch {
        // Fallback
      }
    }
    if (isOpen) {
      loadAssets();
    }
  }, [environment, isOpen]);

  // Update quote whenever asset, amount, or environment changes
  useEffect(() => {
    let isCancelled = false;
    async function fetchQuote() {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setQuote(null);
        return;
      }

      setIsQuoting(true);
      try {
        const res = await fetch('/api/crypto/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: selectedAsset,
            amount: parsedAmount,
            environment,
          }),
        });
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setQuote(data);
        }
      } catch {
        // Handled
      } finally {
        if (!isCancelled) setIsQuoting(false);
      }
    }

    const timer = setTimeout(fetchQuote, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [selectedAsset, amount, environment]);

  if (!isOpen) return null;

  // Handle asset switch
  const handleSelectAsset = (symbol: string) => {
    setSelectedAsset(symbol);
    const assetMeta = assets.find((a) => a.symbol === symbol);
    if (assetMeta && assetMeta.networks.length > 0) {
      setSelectedNetwork(assetMeta.networks[0]);
    }
    if (symbol === 'BTC') setAmount('0.005');
    else if (symbol === 'ETH') setAmount('0.05');
    else if (symbol === 'SOL') setAmount('1.0');
    else if (symbol === 'NEAR') setAmount('10.0');
    else setAmount('25.0');
  };

  // Create deposit intent
  const handleCreateIntent = async () => {
    setErrorMessage(null);
    setIsCreatingIntent(true);
    try {
      const res = await fetch('/api/crypto/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: selectedAsset,
          amount: parseFloat(amount) || 1.0,
          network: selectedNetwork,
          environment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create deposit intent.');
      }

      const intentData: DepositIntent = await res.json();
      setActiveIntent(intentData);
      setSimulationStep(1);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating deposit intent');
    } finally {
      setIsCreatingIntent(false);
    }
  };

  // Simulate real wallet payment & 1Click solver lifecycle
  const handleSimulatePayment = async () => {
    if (!activeIntent) return;
    setIsSimulating(true);

    try {
      setSimulationStep(2);
      await new Promise((r) => setTimeout(r, 900));

      setSimulationStep(3);
      await new Promise((r) => setTimeout(r, 1100));

      const res = await fetch('/api/crypto/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: activeIntent.intentId,
          autoFinish: true,
        }),
      });

      if (res.ok) {
        const updatedIntent = await res.json();
        setActiveIntent(updatedIntent);
        setSimulationStep(4);
        onBalanceUpdated();
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Handle Mobile Money deposit
  const handleMomoDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMomoSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/funding/momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: momoProvider,
          phone: momoPhone,
          amountGhs: parseFloat(momoAmountGhs) || 100,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process Mobile Money funding.');
      }

      setMomoSuccess(true);
      onBalanceUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Mobile Money request failed.');
    } finally {
      setIsMomoSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setActiveIntent(null);
    setSimulationStep(0);
    setMomoSuccess(false);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E5E5EA] overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E5EA] flex justify-between items-center bg-[#F7F8FA]/60 shrink-0">
          <div className="flex items-center gap-2.5">
            {activeIntent ? (
              <button
                onClick={handleReset}
                className="p-1.5 rounded-full hover:bg-white border border-transparent hover:border-[#E5E5EA] text-[#6E6E73] hover:text-[#0B0B0C] transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0A84FF] flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0B0B0C] leading-none">
                {activeIntent
                  ? activeIntent.status === 'CREDITED'
                    ? 'Deposit Credited!'
                    : 'Send Deposit'
                  : activeTab === 'momo'
                  ? 'Mobile Money Top-up'
                  : 'Add Money to Obiba'}
              </h2>
              <p className="text-[11px] text-[#6E6E73] mt-1 font-medium">
                {activeIntent
                  ? `NEAR Intents 1Click · ${activeIntent.environment.toUpperCase()}`
                  : 'One unified USDC digital dollar balance'}
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

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ACTIVE INTENT SCREEN */}
          {activeIntent ? (
            <div className="space-y-5">
              {/* Environment & Network Banner */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
                  activeIntent.environment === 'testnet'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeIntent.environment === 'testnet' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                  <span>
                    {activeIntent.environment === 'testnet' ? 'TESTNET MODE' : 'MAINNET LIVE'} · {activeIntent.network}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/70">
                  {activeIntent.sourceAmount} {activeIntent.sourceAsset}
                </span>
              </div>

              {/* Status Stepper Card */}
              <div className="p-4 bg-[#F7F8FA] border border-[#E5E5EA] rounded-3xl space-y-3">
                <div className="text-xs font-bold text-[#0B0B0C] flex justify-between items-center">
                  <span>Cross-Chain Intent Status</span>
                  <span className="text-[10px] font-mono text-[#6E6E73]">
                    {activeIntent.status === 'CREDITED' ? 'SETTLED' : 'IN PROGRESS'}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Step 1 */}
                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        simulationStep >= 1
                          ? 'bg-[#0A84FF] text-white'
                          : 'bg-white border border-[#E5E5EA] text-[#6E6E73]'
                      }`}
                    >
                      {simulationStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                    </div>
                    <span className={simulationStep === 1 ? 'font-bold text-[#0B0B0C]' : 'text-[#6E6E73]'}>
                      Awaiting {activeIntent.sourceAsset} deposit
                    </span>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        simulationStep >= 2
                          ? 'bg-[#0A84FF] text-white'
                          : 'bg-white border border-[#E5E5EA] text-[#6E6E73]'
                      }`}
                    >
                      {simulationStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                    </div>
                    <span className={simulationStep === 2 ? 'font-bold text-[#0B0B0C]' : 'text-[#6E6E73]'}>
                      Deposit detected on {activeIntent.network}
                    </span>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        simulationStep >= 3
                          ? 'bg-[#0A84FF] text-white'
                          : 'bg-white border border-[#E5E5EA] text-[#6E6E73]'
                      }`}
                    >
                      {simulationStep > 3 ? <Check className="w-3.5 h-3.5" /> : '3'}
                    </div>
                    <span className={simulationStep === 3 ? 'font-bold text-[#0B0B0C]' : 'text-[#6E6E73]'}>
                      NEAR Intents 1Click Solvers converting to USDC
                    </span>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        simulationStep >= 4
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-[#E5E5EA] text-[#6E6E73]'
                      }`}
                    >
                      {simulationStep >= 4 ? <Check className="w-3.5 h-3.5" /> : '4'}
                    </div>
                    <span className={simulationStep >= 4 ? 'font-bold text-emerald-700' : 'text-[#6E6E73]'}>
                      Settled & Credited to Obiba Balance (+{activeIntent.estimatedUsdcDisplay} USDC)
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code and Deposit Address Card */}
              {activeIntent.status !== 'CREDITED' ? (
                <div className="p-4 bg-white border border-[#E5E5EA] rounded-3xl shadow-sm text-center space-y-4">
                  <div className="flex justify-center">
                    <QRCodeSVG value={activeIntent.depositAddress} size={160} />
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider">
                      Single-Use Deposit Address ({activeIntent.network})
                    </div>
                    <div className="p-3 bg-[#F7F8FA] border border-[#E5E5EA] rounded-2xl flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-[#0B0B0C] truncate select-all">
                        {activeIntent.depositAddress}
                      </span>
                      <button
                        onClick={() => handleCopy(activeIntent.depositAddress)}
                        className="p-1.5 rounded-xl bg-white border border-[#E5E5EA] text-[#0A84FF] hover:bg-blue-50 transition shrink-0 flex items-center gap-1 text-[11px] font-bold"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 text-left space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#0A84FF]" />
                      <span>Automated 1Click Cross-Chain Swap</span>
                    </div>
                    <p className="text-[#6E6E73] leading-relaxed">
                      Send exactly <strong>{activeIntent.sourceAmount} {activeIntent.sourceAsset}</strong> on{' '}
                      <strong>{activeIntent.network}</strong>. Defuse solvers will automatically swap it to{' '}
                      <strong>{activeIntent.estimatedUsdcDisplay} USDC</strong> and credit your Obiba One Balance.
                    </p>
                  </div>

                  {/* Interactive Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleSimulatePayment}
                      disabled={isSimulating}
                      className="w-full py-3 px-4 bg-[#0A84FF] hover:bg-[#0066CC] disabled:opacity-60 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95"
                    >
                      {isSimulating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Simulating Wallet Send & Solver Settlement...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Simulate Wallet Deposit ({activeIntent.environment.toUpperCase()})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* SUCCESS STATE */
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-emerald-950">Deposit Confirmed & Credited</h3>
                    <p className="text-xs text-emerald-800 mt-1">
                      Your Obiba account balance has been credited with{' '}
                      <strong>{activeIntent.estimatedUsdcDisplay} USDC</strong>.
                    </p>
                  </div>
                  <div className="p-3 bg-white/80 border border-emerald-200 rounded-2xl text-xs space-y-1 text-left font-mono">
                    <div className="flex justify-between">
                      <span className="text-[#6E6E73]">Settlement Hash:</span>
                      <span className="text-emerald-900 font-bold truncate max-w-[180px]">
                        {activeIntent.settlementTxHash || 'near_tx_0x9f4a2b1c'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6E6E73]">Amount:</span>
                      <span className="text-[#0B0B0C] font-bold">+{activeIntent.estimatedUsdcDisplay} USDC</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onBalanceUpdated();
                      onClose();
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition"
                  >
                    Done · View Updated Balance
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* CONFIGURATION TABS (CRYPTO OR MOMO) */
            <div className="space-y-5">
              
              {/* Method Switcher Pills */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F8FA] border border-[#E5E5EA] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('crypto')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'crypto'
                      ? 'bg-white text-[#0A84FF] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#0B0B0C]'
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>Crypto (NEAR Intents)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('momo')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'momo'
                      ? 'bg-white text-[#0A84FF] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#0B0B0C]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile Money (GHS)</span>
                </button>
              </div>

              {activeTab === 'crypto' ? (
                /* CRYPTO DEPOSIT FLOW */
                <div className="space-y-5">
                  {/* TESTNET vs MAINNET Environment Toggle */}
                  <div className="p-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-extrabold text-[#0B0B0C] flex items-center gap-1.5">
                        <span>Network Mode</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            environment === 'testnet'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {environment === 'testnet' ? 'Testnet · Hackathon Sandbox' : 'Mainnet · Real Liquidity'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#6E6E73] mt-0.5">
                        {environment === 'testnet'
                          ? 'Test cross-chain deposits with free testnet tokens.'
                          : 'Real cross-chain settlement on Arbitrum, Base, Solana, Ethereum, NEAR.'}
                      </p>
                    </div>

                    <div className="flex bg-white/80 p-0.5 border border-[#E5E5EA] rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => setEnvironment('testnet')}
                        className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition ${
                          environment === 'testnet'
                            ? 'bg-[#0A84FF] text-white shadow-sm'
                            : 'text-[#6E6E73] hover:text-[#0B0B0C]'
                        }`}
                      >
                        Testnet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnvironment('mainnet')}
                        className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition ${
                          environment === 'mainnet'
                            ? 'bg-[#0A84FF] text-white shadow-sm'
                            : 'text-[#6E6E73] hover:text-[#0B0B0C]'
                        }`}
                      >
                        Mainnet
                      </button>
                    </div>
                  </div>

                  {/* Asset Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#0B0B0C]">
                      Choose Crypto Asset to Deposit
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {assets.map((asset) => (
                        <button
                          key={asset.symbol}
                          type="button"
                          onClick={() => handleSelectAsset(asset.symbol)}
                          className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                            selectedAsset === asset.symbol
                              ? 'border-[#0A84FF] bg-blue-50/50 shadow-sm'
                              : 'border-[#E5E5EA] bg-white hover:border-[#0A84FF]'
                          }`}
                        >
                          <span className="text-lg">{asset.icon}</span>
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold text-[#0B0B0C] leading-none">{asset.symbol}</div>
                            <div className="text-[10px] text-[#6E6E73] truncate mt-0.5">{asset.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Network Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#0B0B0C]">Origin Network</label>
                    <div className="flex flex-wrap gap-2">
                      {(assets.find((a) => a.symbol === selectedAsset)?.networks || []).map((net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setSelectedNetwork(net)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                            selectedNetwork === net
                              ? 'border-[#0A84FF] bg-[#0A84FF] text-white shadow-sm'
                              : 'border-[#E5E5EA] bg-[#F7F8FA] text-[#6E6E73] hover:text-[#0B0B0C]'
                          }`}
                        >
                          {net}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-[#0B0B0C]">Deposit Amount</label>
                      <span className="text-[10px] text-[#6E6E73]">
                        Min:{' '}
                        {assets.find((a) => a.symbol === selectedAsset)?.minDeposit || 0.05}{' '}
                        {selectedAsset}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="1.0"
                        className="w-full px-4 py-3 rounded-2xl border border-[#E5E5EA] bg-[#F7F8FA]/50 text-sm font-semibold text-[#0B0B0C] focus:outline-none focus:border-[#0A84FF] pr-16"
                      />
                      <div className="absolute right-3.5 top-3 text-xs font-bold text-[#6E6E73]">
                        {selectedAsset}
                      </div>
                    </div>

                    {/* Quick Amount Pills */}
                    <div className="flex gap-2 pt-1">
                      {(selectedAsset === 'BTC'
                        ? ['0.001', '0.005', '0.01']
                        : selectedAsset === 'ETH'
                        ? ['0.02', '0.05', '0.1']
                        : selectedAsset === 'SOL'
                        ? ['0.5', '1.0', '2.5']
                        : ['10', '25', '50']
                      ).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAmount(val)}
                          className="px-2.5 py-1 rounded-lg bg-[#F7F8FA] border border-[#E5E5EA] text-[11px] font-semibold text-[#6E6E73] hover:text-[#0B0B0C] transition"
                        >
                          {val} {selectedAsset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live 1Click Solver Quote Card */}
                  {quote && (
                    <div className="p-4 bg-gradient-to-br from-[#F7F8FA] to-blue-50/30 border border-[#E5E5EA] rounded-2xl space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-[#E5E5EA]/70">
                        <span className="text-[#6E6E73] font-medium">Estimated USDC Received:</span>
                        <span className="text-base font-extrabold text-[#0A84FF]">
                          ≈ {quote.netUsdcDisplay} USDC
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-[#6E6E73]">
                        <div className="flex justify-between">
                          <span>Indicative Ghana Cedis:</span>
                          <strong className="text-[#0B0B0C]">
                            ≈ GH₵{(quote.netUsdcDisplay * 15.25).toFixed(2)}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>1Click Solver Route:</span>
                          <span className="text-[#0B0B0C]">
                            {selectedAsset} ({selectedNetwork}) → NEAR Intents → One USDC
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Protocol Conversion Fee:</span>
                          <span className="text-[#0B0B0C]">0.5% (~${(quote.feeUsdcMicro / 1_000_000).toFixed(2)})</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Execution Speed:</span>
                          <span className="text-emerald-700 font-semibold">{quote.executionSpeed}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit CTA */}
                  <button
                    type="button"
                    onClick={handleCreateIntent}
                    disabled={isCreatingIntent || !quote}
                    className="w-full py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] disabled:opacity-60 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition duration-150"
                  >
                    {isCreatingIntent ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating Deposit Intent...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate {environment === 'testnet' ? 'Testnet' : 'Mainnet'} Deposit Address</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* MOBILE MONEY FORM */
                <form onSubmit={handleMomoDeposit} className="space-y-4">
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900">
                    Ghana Mobile Money instantly deposits in Ghana Cedis (GH₵) and credits your One USDC balance at the fixed
                    rate (1 USDC = 15.25 GHS).
                  </div>

                  {/* Provider Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#0B0B0C]">Select Telecom Provider</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['MTN', 'TELECEL', 'AT'] as const).map((prov) => (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => setMomoProvider(prov)}
                          className={`p-3 rounded-2xl border text-xs font-bold text-center transition ${
                            momoProvider === prov
                              ? 'border-[#0A84FF] bg-blue-50 text-[#0A84FF]'
                              : 'border-[#E5E5EA] bg-white text-[#6E6E73] hover:border-[#0A84FF]'
                          }`}
                        >
                          {prov === 'MTN' ? 'MTN MoMo' : prov === 'TELECEL' ? 'Telecel Cash' : 'AT Money'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MoMo Phone */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#0B0B0C]">Mobile Money Phone Number</label>
                    <input
                      type="tel"
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      placeholder="0241234567"
                      required
                      className="w-full px-4 py-3 rounded-2xl border border-[#E5E5EA] bg-[#F7F8FA]/50 text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0A84FF]"
                    />
                  </div>

                  {/* Amount in GHS */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#0B0B0C]">Amount (GH₵)</label>
                    <input
                      type="number"
                      step="1"
                      min="5"
                      value={momoAmountGhs}
                      onChange={(e) => setMomoAmountGhs(e.target.value)}
                      placeholder="100"
                      required
                      className="w-full px-4 py-3 rounded-2xl border border-[#E5E5EA] bg-[#F7F8FA]/50 text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0A84FF]"
                    />
                    <div className="text-[11px] text-[#6E6E73] font-medium pt-0.5">
                      Credited: ≈{' '}
                      <strong className="text-[#0A84FF]">
                        {((parseFloat(momoAmountGhs) || 0) * 0.99 / 15.25).toFixed(2)} USDC
                      </strong>
                    </div>
                  </div>

                  {momoSuccess ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                      <div className="text-sm font-bold text-emerald-800">Prompt Sent & Funds Credited!</div>
                      <button
                        type="button"
                        onClick={() => {
                          onBalanceUpdated();
                          onClose();
                        }}
                        className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-2xl text-xs"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isMomoSubmitting}
                      className="w-full py-3.5 px-6 bg-[#0A84FF] hover:bg-[#0066CC] disabled:opacity-60 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition"
                    >
                      {isMomoSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing MoMo Cash-In...</span>
                        </>
                      ) : (
                        <>
                          <span>Deposit GH₵{momoAmountGhs} via {momoProvider}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
