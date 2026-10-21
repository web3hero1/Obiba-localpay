'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins,
  ArrowUpRight,
  Zap,
  Smartphone,
  Wifi,
  CreditCard,
  LogOut,
  RefreshCw,
  QrCode,
  Store,
  Send,
  Home,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
} from 'lucide-react';
import { ObibaLogo } from '@/components/logo';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{
    firstName: string;
    fullName: string;
    email: string;
    phoneNumber: string;
  }>({
    firstName: 'Member',
    fullName: 'Obiba Member',
    email: '',
    phoneNumber: '',
  });

  const [balanceUsdc, setBalanceUsdc] = useState<number>(0.0);
  const [indicativeGhs, setIndicativeGhs] = useState<number>(0.0);
  const [isSandboxNotice, setIsSandboxNotice] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'home' | 'pay' | 'scan' | 'activity' | 'more'>('home');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadAuthenticatedUser();
  }, []);

  const loadAuthenticatedUser = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Query user's real profile from Supabase profiles table
        let fullName = user.user_metadata?.full_name;
        let phoneNumber = user.user_metadata?.phone_number;

        try {
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('full_name, phone_number')
            .eq('id', user.id)
            .single();

          if (dbProfile?.full_name) fullName = dbProfile.full_name;
          if (dbProfile?.phone_number) phoneNumber = dbProfile.phone_number;
        } catch {
          // Use metadata fallback
        }

        const resolvedName = fullName || user.email?.split('@')[0] || 'Customer';
        const firstName = resolvedName.split(' ')[0] || 'Member';

        setProfile({
          firstName,
          fullName: resolvedName,
          email: user.email || '',
          phoneNumber: phoneNumber || '',
        });

        // Query available balance from Obiba ledger API
        const res = await fetch('/api/wallet');
        if (res.ok) {
          const walletData = await res.json();
          setBalanceUsdc(walletData.availableUsdc || 0.0);
          setIndicativeGhs(walletData.indicativeGhsEquivalent || 0.0);
        }
      } else {
        // Real production enforcement: unauthenticated users are redirected to login
        router.push('/auth/login?redirect=/dashboard');
        return;
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignored
    } finally {
      router.push('/auth/login');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-between items-center p-3 sm:p-6 pb-24 max-w-lg mx-auto">
      
      {/* Top Header */}
      <header className="w-full flex justify-between items-center py-2 px-1">
        <ObibaLogo size="sm" />
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-[#0B0B0C]">{profile.fullName}</div>
            <div className="text-[10px] text-[#6E6E73]">{profile.email}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl bg-white border border-[#E5E5EA] text-[#6E6E73] hover:text-rose-600 hover:border-rose-200 transition"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full space-y-5 my-4">
        
        {/* Welcome Banner */}
        <div className="px-1">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B0B0C] tracking-tight">
            Welcome, {profile.firstName}
          </h1>
          <p className="text-xs text-[#6E6E73] font-medium mt-0.5">
            Your everyday digital dollar account
          </p>
        </div>

        {/* Primary One-USDC Balance Card (PRD §7.1 & §9) */}
        <div className="bg-gradient-to-br from-[#0A84FF] to-[#0066CC] text-white p-6 rounded-3xl shadow-xl shadow-blue-500/10 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-wider text-blue-100 font-semibold flex items-center gap-1.5">
                <span>Available Balance</span>
                <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full text-white font-medium">One Balance</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold mt-1.5 tracking-tight flex items-baseline gap-2">
                <span>{balanceUsdc.toFixed(2)}</span>
                <span className="text-base font-medium text-blue-200">USDC</span>
              </div>
              <div className="text-xs text-blue-100 font-medium mt-1">
                Indicative: <strong className="text-white">≈ GH₵{indicativeGhs.toFixed(2)}</strong>{' '}
                <span className="text-blue-200">(1 USDC = 15.25 GHS)</span>
              </div>
            </div>
            <button
              onClick={loadAuthenticatedUser}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
              title="Refresh Balance"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/20">
            <button
              onClick={() => alert('Add Money modal: Choose Mobile Money, Bank Transfer or Crypto Deposit (NEAR Intents).')}
              className="py-2.5 px-4 bg-white text-[#0A84FF] font-bold rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md hover:bg-blue-50 transition active:scale-95"
            >
              <Coins className="w-4 h-4" />
              <span>Add Money</span>
            </button>
            <button
              onClick={() => alert('Send Money modal: Choose Obiba user transfer or Mobile Money payout.')}
              className="py-2.5 px-4 bg-white/20 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-xs border border-white/30 hover:bg-white/30 transition active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Send Money</span>
            </button>
          </div>
        </div>

        {/* Non-Transactional Sandbox State Notice (PRD §9) */}
        {isSandboxNotice && (
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3 text-xs text-[#0B0B0C]">
            <ShieldCheck className="w-4 h-4 text-[#0A84FF] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-[#0A84FF]">Verified Account · Sandbox Mode</div>
              <div className="text-[#6E6E73] text-[11px] leading-relaxed">
                Your email is confirmed and your double-entry ledger account is active. Transactions are simulated for the NEAR Hackathon.
              </div>
            </div>
          </div>
        )}

        {/* Everyday Services Grid */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider px-1">
            Everyday Services
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            <button
              onClick={() => alert('ECG Prepaid Electricity payment flow ready.')}
              className="p-3 bg-white border border-[#E5E5EA] rounded-2xl flex flex-col items-center justify-center hover:border-[#0A84FF] transition group shadow-sm active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-[#0B0B0C]">Bills</span>
            </button>

            <button
              onClick={() => alert('Airtime top-up flow ready.')}
              className="p-3 bg-white border border-[#E5E5EA] rounded-2xl flex flex-col items-center justify-center hover:border-[#0A84FF] transition group shadow-sm active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-[#0B0B0C]">Airtime</span>
            </button>

            <button
              onClick={() => alert('Data bundles catalogue ready.')}
              className="p-3 bg-white border border-[#E5E5EA] rounded-2xl flex flex-col items-center justify-center hover:border-[#0A84FF] transition group shadow-sm active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                <Wifi className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-[#0B0B0C]">Data</span>
            </button>

            <button
              onClick={() => alert('Withdraw to Ghana MoMo or Bank transfer ready.')}
              className="p-3 bg-white border border-[#E5E5EA] rounded-2xl flex flex-col items-center justify-center hover:border-[#0A84FF] transition group shadow-sm active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-1 group-hover:scale-105 transition">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-[#0B0B0C]">Withdraw</span>
            </button>
          </div>
        </div>

        {/* Authenticated Profile Details Card */}
        <div className="p-4 bg-white border border-[#E5E5EA] rounded-2xl shadow-sm space-y-2 text-xs">
          <div className="font-bold text-[#0B0B0C] flex items-center justify-between">
            <span>Account Profile</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Verified
            </span>
          </div>
          <div className="space-y-1 text-[#6E6E73]">
            <div className="flex justify-between">
              <span>Full Name:</span>
              <strong className="text-[#0B0B0C]">{profile.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span>Email:</span>
              <span className="text-[#0B0B0C] font-mono">{profile.email}</span>
            </div>
            <div className="flex justify-between">
              <span>Contact Phone:</span>
              <span className="text-[#0B0B0C] font-mono">{profile.phoneNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Primary Currency:</span>
              <strong className="text-[#0A84FF]">USDC (Single Account)</strong>
            </div>
          </div>
        </div>

      </main>

      {/* Bottom Navigation (Home · Pay · Scan QR · Activity · More) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#E5E5EA] py-2 px-6 flex justify-around items-center max-w-lg mx-auto z-20">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center text-xs font-bold ${
            activeTab === 'home' ? 'text-[#0A84FF]' : 'text-[#6E6E73] hover:text-[#0B0B0C]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        <button
          onClick={() => alert('Pay / Send money interface')}
          className="flex flex-col items-center text-xs font-medium text-[#6E6E73] hover:text-[#0B0B0C]"
        >
          <Send className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Pay</span>
        </button>

        {/* Elevated Scan QR Button */}
        <button
          onClick={() => alert('Scan QR Code for Merchant payment')}
          className="w-12 h-12 -mt-6 bg-[#0A84FF] rounded-full text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition"
        >
          <QrCode className="w-6 h-6" />
        </button>

        <button
          onClick={() => alert('Transaction history & receipts')}
          className="flex flex-col items-center text-xs font-medium text-[#6E6E73] hover:text-[#0B0B0C]"
        >
          <ClockIcon className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Activity</span>
        </button>

        <button
          onClick={() => alert('More account settings & profile management')}
          className="flex flex-col items-center text-xs font-medium text-[#6E6E73] hover:text-[#0B0B0C]"
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">More</span>
        </button>
      </nav>

    </div>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
    </svg>
  );
}
