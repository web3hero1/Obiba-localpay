'use client';

import React, { useState, useEffect } from 'react';
import {
  Coins,
  ArrowUpRight,
  Zap,
  Smartphone,
  Wifi,
  CreditCard,
  RefreshCw,
  Terminal,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  QrCode,
  Store,
  Send,
  Home,
  Sliders,
} from 'lucide-react';
import { UserBalance, DepositIntent, TransactionRecord, LedgerJournal } from '@/lib/types';

export default function ObibaApp() {
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [journals, setJournals] = useState<LedgerJournal[]>([]);
  const [custodyUsdc, setCustodyUsdc] = useState<number>(0);
  const [feeRevenue, setFeeRevenue] = useState<number>(0);
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'home' | 'pay' | 'scan' | 'activity' | 'inspect'>('home');

  // Modals & Active Sections
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>('SOL');
  const [cryptoAmount, setCryptoAmount] = useState<number>(1.0);
  const [cryptoQuote, setCryptoQuote] = useState<any>(null);
  const [activeIntent, setActiveIntent] = useState<DepositIntent | null>(null);

  // MoMo & Bills Form States
  const [momoProvider, setMomoProvider] = useState<string>('MTN');
  const [momoPhone, setMomoPhone] = useState<string>('0241234567');
  const [momoAmountGhs, setMomoAmountGhs] = useState<number>(300);

  const [payoutPhone, setPayoutPhone] = useState<string>('0559876543');
  const [payoutAmountGhs, setPayoutAmountGhs] = useState<number>(50);

  const [meterNumber, setMeterNumber] = useState<string>('482019-2041');
  const [meterValidation, setMeterValidation] = useState<string>('Kwame Mensah - East Legon (RLV)');
  const [ecgAmountGhs, setEcgAmountGhs] = useState<number>(100);

  const [merchantReq, setMerchantReq] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Initial Data Fetching
  useEffect(() => {
    fetchWallet();
    fetchTransactions();
    fetchLedger();
    fetchCryptoQuote('SOL', 1.0);
  }, []);

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/wallet');
      const data = await res.json();
      setBalance(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/wallet/transactions');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/admin/ledger');
      const data = await res.json();
      setJournals(data.journals || []);
      setCustodyUsdc(data.custodyPoolUsdc || 0);
      setFeeRevenue(data.feeRevenueUsdc || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCryptoQuote = async (asset: string, amt: number) => {
    try {
      const res = await fetch('/api/crypto/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, amount: amt }),
      });
      const data = await res.json();
      setCryptoQuote(data);
    } catch (e) {
      console.error(e);
    }
  };

  // NEAR Intents: Create Deposit Intent
  const handleCreateIntent = async () => {
    try {
      const res = await fetch('/api/crypto/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: selectedAsset,
          amount: cryptoAmount,
          network: selectedAsset === 'SOL' ? 'Solana Mainnet' : (selectedAsset === 'BTC' ? 'Bitcoin Network' : 'Arbitrum One'),
        }),
      });
      const intent = await res.json();
      setActiveIntent(intent);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // NEAR Intents: Step Solver Lifecycle
  const handleStepSolver = async () => {
    if (!activeIntent) return;
    try {
      const res = await fetch('/api/crypto/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: activeIntent.intentId }),
      });
      const updated = await res.json();
      setActiveIntent(updated);

      if (updated.status === 'CREDITED' || updated.status === 'SETTLEMENT_VERIFIED') {
        await fetchWallet();
        await fetchTransactions();
        await fetchLedger();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // MoMo Funding (Cash-In)
  const handleMomoFunding = async () => {
    try {
      const res = await fetch('/api/funding/momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: momoProvider, phone: momoPhone, amountGhs: momoAmountGhs }),
      });
      const data = await res.json();
      setActiveModal(null);
      await fetchWallet();
      await fetchTransactions();
      await fetchLedger();
      setReceiptData({
        title: 'Money Added via MoMo',
        subtitle: `GH₵${momoAmountGhs.toFixed(2)} approved via USSD push.`,
        detail: `Credited $${data.creditedUsdcDisplay} USDC to available balance.`,
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  // MoMo Payout
  const handleMomoPayout = async () => {
    try {
      const res = await fetch('/api/payouts/momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: momoProvider, phone: payoutPhone, amountGhs: payoutAmountGhs }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setActiveModal(null);
      await fetchWallet();
      await fetchTransactions();
      await fetchLedger();
      setReceiptData({
        title: 'MoMo Payout Delivered',
        subtitle: `GH₵${payoutAmountGhs.toFixed(2)} sent to ${payoutPhone} (${momoProvider}).`,
        detail: `Debited $${data.debitedUsdcDisplay} USDC from available balance.`,
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ECG Bill Payment
  const handlePayEcg = async () => {
    try {
      const res = await fetch('/api/bills/ecg/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterNumber, amountGhs: ecgAmountGhs }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setActiveModal(null);
      await fetchWallet();
      await fetchTransactions();
      await fetchLedger();
      setReceiptData({
        title: 'ECG Electricity Token Generated',
        subtitle: `Recharged GH₵${ecgAmountGhs} (${data.fulfillment.kwhUnits} kWh) for ${data.fulfillment.customerName}.`,
        detail: `Debited $${data.debitedUsdcDisplay} USDC.`,
        token: data.fulfillment.token,
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Merchant QR Scanner / Payment
  const handleScanMerchantQR = async () => {
    try {
      const res = await fetch('/api/merchant/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantName: 'Starbites Restaurant - Osu',
          category: 'Dining & Food',
          amountGhs: 120.0,
        }),
      });
      const req = await res.json();
      setMerchantReq(req);
      setActiveModal('scan-merchant');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePayMerchant = async () => {
    if (!merchantReq) return;
    try {
      const res = await fetch('/api/merchant/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: merchantReq.requestId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setActiveModal(null);
      setMerchantReq(null);
      await fetchWallet();
      await fetchTransactions();
      await fetchLedger();
      setReceiptData({
        title: 'Merchant Payment Settled',
        subtitle: `Paid GH₵${data.amountGhs.toFixed(2)} to ${data.merchantName}.`,
        detail: `Debited $${data.debitedUsdcDisplay} USDC from available balance.`,
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen p-3 lg:p-6 gap-6 justify-center items-start max-w-7xl mx-auto">
      
      {/* ================= LEFT: OBIBA WEB APP VIEWPORT ================= */}
      <div className="w-full lg:w-[450px] bg-white rounded-3xl border border-brand-border shadow-xl overflow-hidden flex flex-col relative">
        
        {/* Header */}
        <div className="p-5 border-b border-brand-border/60 flex justify-between items-center bg-brand-bg/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-blue text-white flex items-center justify-center font-bold text-lg shadow-sm">
              O
            </div>
            <div>
              <div className="text-xs text-brand-secondary font-medium">Obiba Web Platform · NEAR Intents</div>
              <div className="text-sm font-bold text-brand-text flex items-center gap-1.5">
                <span>Kwame Mensah</span>
                <span className="text-[11px] bg-blue-100 text-brand-blue font-semibold px-2 py-0.5 rounded-full">Ghana</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowInspector(!showInspector)}
            className="p-2 rounded-xl bg-white border border-brand-border text-brand-blue hover:bg-blue-50 transition"
            title="Toggle Ledger Inspector"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 pb-24">
          
          {/* Main One-USDC Balance Card (PRD §7.1) */}
          <div className="bg-gradient-to-br from-[#0A84FF] to-[#0066CC] text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs uppercase tracking-wider text-blue-100 font-semibold flex items-center gap-1.5">
                  <span>Obiba USDC Balance</span>
                  <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full text-white font-medium">One Balance</span>
                </div>
                <div className="text-3xl font-extrabold mt-1 tracking-tight flex items-baseline gap-1.5">
                  <span>${balance ? balance.availableUsdc.toFixed(2) : '56.28'}</span>
                  <span className="text-sm font-medium text-blue-200">USDC</span>
                </div>
                <div className="text-xs text-blue-100 font-medium mt-1">
                  Indicative: <strong className="text-white">≈ GH₵{balance ? balance.indicativeGhsEquivalent.toFixed(2) : '858.27'}</strong>{' '}
                  <span className="text-blue-200">(1 USDC = 15.25 GHS)</span>
                </div>
              </div>
              <button onClick={fetchWallet} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/20">
              <button
                onClick={() => { setActiveModal('deposit-crypto'); setActiveIntent(null); }}
                className="py-2.5 px-3 bg-white text-brand-blue font-bold rounded-2xl flex items-center justify-center gap-2 text-xs shadow hover:bg-blue-50 transition active:scale-95"
              >
                <Coins className="w-4 h-4" />
                <span>+ Deposit Crypto</span>
              </button>
              <button
                onClick={() => setActiveModal('payout-momo')}
                className="py-2.5 px-3 bg-white/20 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-xs border border-white/30 hover:bg-white/25 transition active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Send Money</span>
              </button>
            </div>
          </div>

          {/* NEAR Intents 1Click Active Ribbon */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-blue text-white flex items-center justify-center text-xs font-bold">
                Ⓝ
              </div>
              <div>
                <div className="text-xs font-bold text-brand-text">NEAR Intents 1Click Active</div>
                <div className="text-[11px] text-brand-secondary">Deposit BTC, ETH, SOL, USDT to USDC</div>
              </div>
            </div>
            <button
              onClick={() => { setActiveModal('deposit-crypto'); setActiveIntent(null); }}
              className="px-3 py-1 bg-white border border-brand-blue text-brand-blue text-xs font-bold rounded-xl hover:bg-blue-50 transition shadow-sm"
            >
              Deposit
            </button>
          </div>

          {/* Everyday Services Grid */}
          <div>
            <div className="text-xs font-bold text-brand-secondary uppercase tracking-wider mb-2.5">
              Everyday Ghanaian Services
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              <button
                onClick={() => setActiveModal('bills-ecg')}
                className="p-3 bg-white border border-brand-border rounded-2xl flex flex-col items-center justify-center hover:border-brand-blue transition group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-brand-text">ECG Power</span>
              </button>

              <button
                onClick={() => setActiveModal('funding-momo')}
                className="p-3 bg-white border border-brand-border rounded-2xl flex flex-col items-center justify-center hover:border-brand-blue transition group"
              >
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-brand-text">Add MoMo</span>
              </button>

              <button
                onClick={() => setActiveModal('payout-momo')}
                className="p-3 bg-white border border-brand-border rounded-2xl flex flex-col items-center justify-center hover:border-brand-blue transition group"
              >
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-brand-text">Withdraw</span>
              </button>

              <button
                onClick={handleScanMerchantQR}
                className="p-3 bg-white border border-brand-border rounded-2xl flex flex-col items-center justify-center hover:border-brand-blue transition group"
              >
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                  <Store className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-brand-text">Merchant QR</span>
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <div className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Recent Activity</div>
              <button onClick={fetchTransactions} className="text-xs text-brand-blue font-semibold hover:underline">
                Refresh
              </button>
            </div>
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="p-4 bg-white rounded-2xl border border-brand-border text-center text-xs text-brand-secondary">
                  No transactions yet.
                </div>
              ) : (
                transactions.slice(0, 5).map((tx) => {
                  const isCredit = tx.type.includes('DEPOSIT') || tx.type.includes('IN');
                  return (
                    <div
                      key={tx.transactionId}
                      className="p-3 bg-white rounded-2xl border border-brand-border flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full ${
                            isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-brand-blue'
                          } flex items-center justify-center`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-brand-text truncate max-w-[180px]">
                            {tx.description}
                          </div>
                          <div className="text-[10px] text-brand-secondary">
                            {new Date(tx.createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                            · {tx.counterparty}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-bold ${isCredit ? 'text-emerald-600' : 'text-brand-text'}`}>
                          {isCredit ? '+' : '-'}${ (tx.netAmountMicro / 1_000_000).toFixed(2) } USDC
                        </div>
                        <div className="text-[9px] text-emerald-600 font-semibold">Settled</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Navigation Bar (Home, Pay, Scan, Activity) */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur border-t border-brand-border px-6 flex justify-between items-center z-10">
          <button onClick={() => setActiveTab('home')} className="flex flex-col items-center text-brand-blue">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Home</span>
          </button>
          <button onClick={() => setActiveModal('payout-momo')} className="flex flex-col items-center text-brand-secondary hover:text-brand-blue transition">
            <Send className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Pay</span>
          </button>
          <button onClick={handleScanMerchantQR} className="w-11 h-11 -mt-4 bg-brand-blue rounded-full text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition">
            <QrCode className="w-5 h-5" />
          </button>
          <button onClick={fetchTransactions} className="flex flex-col items-center text-brand-secondary hover:text-brand-blue transition">
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Activity</span>
          </button>
          <button onClick={() => setShowInspector(!showInspector)} className="flex flex-col items-center text-brand-secondary hover:text-brand-blue transition">
            <Sliders className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Audit</span>
          </button>
        </div>

      </div>

      {/* ================= RIGHT: HACKATHON LEDGER & SOLVER INSPECTOR ================= */}
      {showInspector && (
        <div className="w-full lg:flex-1 bg-white rounded-3xl p-5 border border-brand-border shadow-xl flex flex-col space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <h2 className="text-sm font-bold text-brand-text">Hackathon Ledger & Solver Inspector</h2>
            </div>
            <span className="text-xs bg-blue-100 text-brand-blue font-bold px-2 py-0.5 rounded-full">
              PostgreSQL Double-Entry Core
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-brand-bg rounded-2xl border border-brand-border">
              <div className="text-xs text-brand-secondary font-medium">1000 - USDC Settlement Custody</div>
              <div className="text-lg font-bold text-brand-text mt-0.5">${custodyUsdc.toFixed(2)} USDC</div>
            </div>
            <div className="p-3 bg-brand-bg rounded-2xl border border-brand-border">
              <div className="text-xs text-brand-secondary font-medium">4000 - Conversion Fee Revenue</div>
              <div className="text-lg font-bold text-emerald-600 mt-0.5">${feeRevenue.toFixed(2)} USDC</div>
            </div>
          </div>

          {/* NEAR Intents 1Click Solver Payload Inspector */}
          {activeIntent && (
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between font-bold text-purple-900">
                <span>Active NEAR Intents 1Click Order</span>
                <span className="font-mono text-[11px]">{activeIntent.intentId}</span>
              </div>
              <div className="text-[11px] text-purple-800 space-y-1">
                <div>Route: <strong>{activeIntent.solverInfo.route}</strong></div>
                <div>One-Time Deposit Address: <strong className="font-mono">{activeIntent.depositAddress}</strong></div>
                <div>Status: <strong className="uppercase text-purple-700">{activeIntent.status}</strong></div>
              </div>
            </div>
          )}

          {/* Live Double-Entry Journal Entries */}
          <div>
            <div className="text-xs font-bold text-brand-secondary uppercase tracking-wider mb-2">
              Live Double-Entry Journal Stream (Sum of Debits = Sum of Credits)
            </div>
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto hide-scrollbar">
              {journals.map((j) => (
                <div key={j.journalId} className="p-3 bg-brand-bg rounded-2xl border border-brand-border text-xs space-y-1.5">
                  <div className="flex justify-between font-bold text-brand-text">
                    <span className="text-brand-blue truncate max-w-[220px]">{j.reference}</span>
                    <span className="font-mono text-[10px] text-brand-secondary">{j.journalId}</span>
                  </div>
                  <div className="text-[11px] text-brand-secondary">{j.narration}</div>
                  <div className="pt-1.5 border-t border-brand-border space-y-1 font-mono text-[11px]">
                    {j.entries.map((e) => (
                      <div
                        key={e.entryId}
                        className={`flex justify-between ${e.direction === 'DEBIT' ? 'text-blue-700' : 'text-emerald-700'}`}
                      >
                        <span className="truncate max-w-[260px]">
                          {e.direction} {e.accountId}
                        </span>
                        <span>{(e.amount / 1_000_000).toFixed(2)} {e.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DEPOSIT CRYPTO (NEAR INTENTS 1CLICK) ================= */}
      {activeModal === 'deposit-crypto' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-brand-text">Deposit Crypto</h3>
                <p className="text-xs text-brand-secondary">Powered by NEAR Intents 1Click API</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-brand-secondary hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!activeIntent ? (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-brand-secondary mb-1">Select Asset</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['SOL', 'ETH', 'BTC', 'USDT'].map((sym) => (
                      <button
                        key={sym}
                        onClick={() => {
                          setSelectedAsset(sym);
                          fetchCryptoQuote(sym, cryptoAmount);
                        }}
                        className={`p-2 rounded-xl text-center font-bold text-xs border ${
                          selectedAsset === sym ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-brand-border bg-white'
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-secondary mb-1">Deposit Amount</label>
                  <input
                    type="number"
                    value={cryptoAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCryptoAmount(val);
                      fetchCryptoQuote(selectedAsset, val);
                    }}
                    className="w-full p-2.5 rounded-xl border border-brand-border font-bold text-sm"
                  />
                </div>

                {cryptoQuote && (
                  <div className="p-3 bg-brand-bg rounded-xl border border-brand-border text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-brand-secondary">Expected USDC:</span>
                      <strong className="text-emerald-600">${cryptoQuote.netUsdcDisplay} USDC</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-secondary">Solver Protocol Fee:</span>
                      <span>0.5%</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreateIntent}
                  className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl text-xs shadow hover:bg-brand-darkBlue transition"
                >
                  Generate 1Click Deposit Address
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs space-y-1 text-center">
                  <div className="text-brand-secondary">Deposit {activeIntent.sourceAmount} {activeIntent.sourceAsset} to:</div>
                  <div className="font-mono font-bold text-[11px] text-brand-text break-all p-2 bg-white rounded-xl border border-blue-200">
                    {activeIntent.depositAddress}
                  </div>
                </div>

                <div className="p-3 border border-brand-border rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-brand-text">Solver State Machine:</div>
                  <div className="space-y-1">
                    <div className={activeIntent.status === 'AWAITING_DEPOSIT' ? 'text-brand-blue font-bold' : 'text-gray-400'}>
                      1. Awaiting Deposit on Source Chain
                    </div>
                    <div className={activeIntent.status === 'DEPOSIT_DETECTED' ? 'text-brand-blue font-bold' : 'text-gray-400'}>
                      2. Deposit Detected
                    </div>
                    <div className={activeIntent.status === 'CONVERTING' ? 'text-brand-blue font-bold' : 'text-gray-400'}>
                      3. Solvers Competing & Converting
                    </div>
                    <div className={activeIntent.status === 'CREDITED' ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                      4. Verified & Credited to USDC Ledger
                    </div>
                  </div>
                </div>

                {activeIntent.status !== 'CREDITED' ? (
                  <button
                    onClick={handleStepSolver}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow hover:bg-emerald-700 transition"
                  >
                    Advance Solver Simulation ⚡
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveModal(null)}
                    className="w-full py-2.5 bg-brand-text text-white font-bold rounded-xl text-xs"
                  >
                    Done
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: ECG BILL ================= */}
      {activeModal === 'bills-ecg' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-brand-text">Pay ECG Electricity</h3>
                <p className="text-xs text-brand-secondary">Prepaid Meter Token Recharge</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-brand-secondary hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-brand-secondary mb-1">Meter Number</label>
                <input
                  type="text"
                  value={meterNumber}
                  onChange={(e) => setMeterNumber(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-brand-border font-mono font-bold text-sm"
                />
                <div className="text-[11px] text-emerald-600 font-semibold mt-1">✓ {meterValidation}</div>
              </div>

              <div>
                <label className="block font-semibold text-brand-secondary mb-1">Amount (GHS)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setEcgAmountGhs(amt)}
                      className={`p-2 rounded-xl font-bold ${
                        ecgAmountGhs === amt ? 'border-2 border-brand-blue bg-blue-50 text-brand-blue' : 'border border-brand-border'
                      }`}
                    >
                      GH₵{amt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handlePayEcg}
                className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl text-xs shadow hover:bg-brand-darkBlue transition"
              >
                Pay with USDC & Generate Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MOMO PAYOUT ================= */}
      {activeModal === 'payout-momo' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-brand-text">Send to Mobile Money</h3>
                <p className="text-xs text-brand-secondary">Instant Ghanaian Payout Rail</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-brand-secondary hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-brand-secondary mb-1">Recipient Phone</label>
                <input
                  type="text"
                  value={payoutPhone}
                  onChange={(e) => setPayoutPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-brand-border font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-brand-secondary mb-1">Amount Recipient Receives (GHS)</label>
                <input
                  type="number"
                  value={payoutAmountGhs}
                  onChange={(e) => setPayoutAmountGhs(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-brand-border font-bold text-sm"
                />
                <div className="text-[11px] text-brand-secondary mt-1">
                  Debits: ≈ <strong>${((payoutAmountGhs + 1.5) / 15.25).toFixed(2)} USDC</strong>
                </div>
              </div>

              <button
                onClick={handleMomoPayout}
                className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl text-xs shadow hover:bg-brand-darkBlue transition"
              >
                Authorize & Send Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SCAN MERCHANT QR (PRD §18) ================= */}
      {activeModal === 'scan-merchant' && merchantReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-brand-text">Merchant QR Scanned</h3>
                <p className="text-xs text-brand-secondary">Pay directly from your USDC balance</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-brand-secondary hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center mx-auto text-lg font-bold">
                <Store className="w-6 h-6" />
              </div>
              <div className="font-bold text-base text-brand-text">{merchantReq.merchantName}</div>
              <div className="text-xs text-brand-secondary">{merchantReq.merchantCategory}</div>
              <div className="text-2xl font-extrabold text-brand-text mt-2">
                GH₵{merchantReq.amountGhs.toFixed(2)}
              </div>
              <div className="text-xs text-brand-secondary">
                Debits: ≈ <strong className="text-brand-blue">${(merchantReq.amountGhs / 15.25).toFixed(2)} USDC</strong>
              </div>
            </div>

            <button
              onClick={handlePayMerchant}
              className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl text-xs shadow hover:bg-brand-darkBlue transition"
            >
              Authorize Payment (${(merchantReq.amountGhs / 15.25).toFixed(2)} USDC)
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECEIPT ================= */}
      {receiptData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base text-brand-text">{receiptData.title}</h3>
              <p className="text-xs text-brand-secondary">{receiptData.subtitle}</p>
            </div>

            {receiptData.token && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl space-y-1">
                <div className="text-[10px] font-bold text-brand-secondary uppercase">20-Digit Prepaid Token</div>
                <div className="text-base font-mono font-bold text-brand-blue tracking-wider select-all">
                  {receiptData.token}
                </div>
              </div>
            )}

            <div className="p-3 bg-brand-bg rounded-xl border border-brand-border text-xs text-left">
              <div>{receiptData.detail}</div>
              <div className="text-[10px] text-brand-secondary font-mono pt-1 mt-1 border-t border-brand-border">
                Verified on Obiba Double-Entry Ledger
              </div>
            </div>

            <button
              onClick={() => setReceiptData(null)}
              className="w-full py-2.5 bg-brand-text text-white font-bold rounded-xl text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
