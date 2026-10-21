/**
 * Obiba Core Financial Platform — Ghana Local Rails & Merchant Payments (PRD §10, §14-§18)
 */

import { EcgBillFulfillment, TransactionRecord } from './types';
import {
  ledger,
  GHS_PER_USDC,
  userAvailableAccount,
  userReservedAccount,
  ASSET_USDC_SETTLEMENT,
  ASSET_GHS_TREASURY,
  REVENUE_SERVICE_FEES,
} from './ledger';

export const GHANA_MOMO_NETWORKS = [
  { id: 'MTN', name: 'MTN Mobile Money' },
  { id: 'TELECEL', name: 'Telecel Cash' },
  { id: 'AT', name: 'AT Money' },
];

export interface MerchantPaymentRequest {
  requestId: string;
  merchantName: string;
  merchantCategory: string;
  amountGhs: number;
  qrPayload: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  expiresAt: number;
}

class GhanaRailsService {
  private transactions: TransactionRecord[] = [];
  private merchantRequests: Map<string, MerchantPaymentRequest> = new Map();

  constructor() {
    this.transactions.push({
      transactionId: 'tx_seed_001',
      userId: 'user_gh_founder',
      type: 'CRYPTO_DEPOSIT',
      status: 'COMPLETED',
      grossAmountMicro: 56_560_000,
      feeAmountMicro: 280_000,
      netAmountMicro: 56_280_000,
      currency: 'USDC',
      counterparty: 'NEAR Intents (SOL)',
      description: 'Deposit 1.0 SOL via NEAR Intents 1Click',
      journalId: 'jnl_init_01',
      createdAt: Math.floor(Date.now() / 1000) - 3600,
    });

    // Seed sample merchant request
    this.createMerchantRequest('Starbites Restaurant - Osu', 'Dining & Food', 150.0);
  }

  public getTransactions(userId: string): TransactionRecord[] {
    return this.transactions.filter((t) => t.userId === userId);
  }

  // 1. Mobile Money Cash-In (GHS -> USDC)
  public fundViaMomo(params: {
    userId: string;
    provider: string;
    phone: string;
    amountGhs: number;
  }) {
    if (params.amountGhs < 5) throw new Error('Minimum funding is GH₵5.00.');

    const netGhs = params.amountGhs * 0.99; // 1% telecom collection fee
    const usdcCredit = netGhs / GHS_PER_USDC;
    const micro = Math.round(usdcCredit * 1_000_000);

    const journalId = ledger.recordJournal({
      reference: `MOMO-IN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      narration: `Mobile Money deposit from ${params.phone} (${params.provider}) GH₵${params.amountGhs.toFixed(2)}`,
      entries: [
        {
          accountId: ASSET_USDC_SETTLEMENT,
          direction: 'DEBIT',
          amount: micro,
          currency: 'USDC',
        },
        {
          accountId: userAvailableAccount(params.userId),
          direction: 'CREDIT',
          amount: micro,
          currency: 'USDC',
        },
      ],
    });

    const tx: TransactionRecord = {
      transactionId: `tx_momo_in_${Math.random().toString(36).substring(2, 10)}`,
      userId: params.userId,
      type: 'MOMO_DEPOSIT',
      status: 'COMPLETED',
      grossAmountMicro: micro,
      feeAmountMicro: 0,
      netAmountMicro: micro,
      currency: 'USDC',
      counterparty: `${params.provider} (${params.phone})`,
      description: `Added GH₵${params.amountGhs.toFixed(2)} via ${params.provider}`,
      journalId,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.transactions.unshift(tx);

    return {
      transactionId: tx.transactionId,
      amountGhs: params.amountGhs,
      creditedUsdcDisplay: Math.round(usdcCredit * 100) / 100,
      status: 'COMPLETED',
    };
  }

  // 2. Mobile Money Payout (USDC -> GHS recipient)
  public payoutToMomo(params: {
    userId: string;
    provider: string;
    recipientPhone: string;
    amountGhs: number;
  }) {
    const requiredUsdc = (params.amountGhs + 1.5) / GHS_PER_USDC;
    const requiredMicro = Math.round(requiredUsdc * 1_000_000);

    const balance = ledger.getUserBalance(params.userId);
    if (balance.availableUsdcMicro < requiredMicro) {
      throw new Error(
        `Insufficient balance. Needed $${(requiredMicro / 1_000_000).toFixed(2)} USDC, available: $${balance.availableUsdc.toFixed(2)} USDC.`
      );
    }

    // Two-Phase Commit: Hold -> Settle
    const holdRef = `HOLD-MOMO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    ledger.recordJournal({
      reference: holdRef,
      narration: `Hold for MoMo payout to ${params.recipientPhone} GH₵${params.amountGhs}`,
      entries: [
        {
          accountId: userAvailableAccount(params.userId),
          direction: 'DEBIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
        {
          accountId: userReservedAccount(params.userId),
          direction: 'CREDIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
      ],
    });

    const settleRef = `SETTLE-MOMO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const journalId = ledger.recordJournal({
      reference: settleRef,
      narration: `Settled MoMo payout to ${params.recipientPhone} (${params.provider}) GH₵${params.amountGhs}`,
      entries: [
        {
          accountId: userReservedAccount(params.userId),
          direction: 'DEBIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
        {
          accountId: ASSET_USDC_SETTLEMENT,
          direction: 'CREDIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
      ],
    });

    const tx: TransactionRecord = {
      transactionId: `tx_payout_${Math.random().toString(36).substring(2, 10)}`,
      userId: params.userId,
      type: 'MOMO_PAYOUT',
      status: 'COMPLETED',
      grossAmountMicro: requiredMicro,
      feeAmountMicro: 0,
      netAmountMicro: requiredMicro,
      currency: 'USDC',
      counterparty: `${params.provider} (${params.recipientPhone})`,
      description: `Sent GH₵${params.amountGhs.toFixed(2)} to ${params.recipientPhone}`,
      journalId,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.transactions.unshift(tx);

    return {
      transactionId: tx.transactionId,
      amountGhs: params.amountGhs,
      debitedUsdcDisplay: Math.round(requiredUsdc * 100) / 100,
      recipientPhone: params.recipientPhone,
      provider: params.provider,
      status: 'COMPLETED',
    };
  }

  // 3. ECG Electricity Prepaid Bill Payment
  public validateMeter(meterNumber: string) {
    const cleaned = meterNumber.replace(/-/g, '').trim();
    if (cleaned.length < 6) throw new Error('Meter number must be at least 6 digits.');

    const names = [
      'Kwame Mensah - East Legon',
      'Abena Osei - Osu, Accra',
      'Kofi Boateng - Kumasi Central',
      'Akua Darko - Tema Community 1',
    ];
    const customerName = names[parseInt(cleaned.slice(-1), 10) % names.length] || names[0];

    return {
      valid: true,
      meterNumber,
      customerName,
      tariff: 'Residential Low-Voltage (RLV)',
    };
  }

  public payEcgBill(params: { userId: string; meterNumber: string; amountGhs: number }) {
    const requiredUsdc = (params.amountGhs + 0.5) / GHS_PER_USDC;
    const requiredMicro = Math.round(requiredUsdc * 1_000_000);

    const balance = ledger.getUserBalance(params.userId);
    if (balance.availableUsdcMicro < requiredMicro) {
      throw new Error(`Insufficient funds for ECG bill.`);
    }

    const validation = this.validateMeter(params.meterNumber);

    const randDigits = () => Math.floor(1000 + Math.random() * 9000);
    const token = `${randDigits()}-${randDigits()}-${randDigits()}-${randDigits()}-${randDigits()}`;
    const kwhUnits = Math.round((params.amountGhs / 1.55) * 10) / 10;

    const journalId = ledger.recordJournal({
      reference: `BILL-ECG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      narration: `ECG Electricity recharge for meter ${params.meterNumber} GH₵${params.amountGhs}`,
      entries: [
        {
          accountId: userAvailableAccount(params.userId),
          direction: 'DEBIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
        {
          accountId: ASSET_USDC_SETTLEMENT,
          direction: 'CREDIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
      ],
    });

    const fulfillment: EcgBillFulfillment = {
      biller: 'ECG Electricity',
      meterNumber: params.meterNumber,
      customerName: validation.customerName,
      amountGhs: params.amountGhs,
      kwhUnits,
      token,
      receiptNumber: `ECG-${Math.floor(10000000 + Math.random() * 90000000)}`,
      timestamp: Math.floor(Date.now() / 1000),
      instructions: 'Enter the 20-digit token into your ECG CIU keypad and press Enter.',
    };

    const tx: TransactionRecord = {
      transactionId: `tx_ecg_${Math.random().toString(36).substring(2, 10)}`,
      userId: params.userId,
      type: 'BILL_PAYMENT',
      status: 'COMPLETED',
      grossAmountMicro: requiredMicro,
      feeAmountMicro: 0,
      netAmountMicro: requiredMicro,
      currency: 'USDC',
      counterparty: `ECG (${params.meterNumber})`,
      description: `Electricity purchase for ${params.meterNumber}`,
      journalId,
      metadata: fulfillment as unknown as Record<string, unknown>,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.transactions.unshift(tx);

    return {
      transactionId: tx.transactionId,
      debitedUsdcDisplay: Math.round(requiredUsdc * 100) / 100,
      fulfillment,
      status: 'COMPLETED',
    };
  }

  // 4. Airtime & Mobile Data Recharge
  public rechargeTelecom(params: {
    userId: string;
    category: 'AIRTIME' | 'DATA';
    provider: string;
    phone: string;
    amountGhs: number;
    bundleName?: string;
  }) {
    const requiredUsdc = (params.amountGhs + 0.2) / GHS_PER_USDC;
    const requiredMicro = Math.round(requiredUsdc * 1_000_000);

    const balance = ledger.getUserBalance(params.userId);
    if (balance.availableUsdcMicro < requiredMicro) {
      throw new Error(`Insufficient funds for ${params.category.toLowerCase()}.`);
    }

    const journalId = ledger.recordJournal({
      reference: `${params.category}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      narration: `${params.category} recharge for ${params.phone} (${params.provider}) GH₵${params.amountGhs}`,
      entries: [
        {
          accountId: userAvailableAccount(params.userId),
          direction: 'DEBIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
        {
          accountId: ASSET_USDC_SETTLEMENT,
          direction: 'CREDIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
      ],
    });

    const tx: TransactionRecord = {
      transactionId: `tx_tel_${Math.random().toString(36).substring(2, 10)}`,
      userId: params.userId,
      type: params.category,
      status: 'COMPLETED',
      grossAmountMicro: requiredMicro,
      feeAmountMicro: 0,
      netAmountMicro: requiredMicro,
      currency: 'USDC',
      counterparty: `${params.provider} (${params.phone})`,
      description: `${params.bundleName || 'Airtime'} for ${params.phone}`,
      journalId,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.transactions.unshift(tx);

    return {
      transactionId: tx.transactionId,
      debitedUsdcDisplay: Math.round(requiredUsdc * 100) / 100,
      status: 'COMPLETED',
    };
  }

  // 5. Merchant QR Code Generation & Payment (PRD §18)
  public createMerchantRequest(merchantName: string, category: string, amountGhs: number): MerchantPaymentRequest {
    const requestId = `mreq_${Math.random().toString(36).substring(2, 10)}`;
    const now = Math.floor(Date.now() / 1000);
    const request: MerchantPaymentRequest = {
      requestId,
      merchantName,
      merchantCategory: category,
      amountGhs,
      qrPayload: `obiba:pay?req=${requestId}&amt=${amountGhs}&m=${encodeURIComponent(merchantName)}`,
      status: 'PENDING',
      expiresAt: now + 1800,
    };
    this.merchantRequests.set(requestId, request);
    return request;
  }

  public getMerchantRequest(requestId: string): MerchantPaymentRequest {
    const req = this.merchantRequests.get(requestId);
    if (!req) throw new Error(`Merchant request '${requestId}' not found or expired.`);
    return req;
  }

  public payMerchant(params: { userId: string; requestId: string }) {
    const req = this.getMerchantRequest(params.requestId);
    if (req.status === 'PAID') throw new Error('Payment request has already been paid.');

    const requiredUsdc = req.amountGhs / GHS_PER_USDC;
    const requiredMicro = Math.round(requiredUsdc * 1_000_000);

    const balance = ledger.getUserBalance(params.userId);
    if (balance.availableUsdcMicro < requiredMicro) {
      throw new Error(`Insufficient funds for merchant payment.`);
    }

    const journalId = ledger.recordJournal({
      reference: `PAY-MERCH-${req.requestId}`,
      narration: `Merchant payment to ${req.merchantName} GH₵${req.amountGhs.toFixed(2)}`,
      entries: [
        {
          accountId: userAvailableAccount(params.userId),
          direction: 'DEBIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
        {
          accountId: ASSET_USDC_SETTLEMENT,
          direction: 'CREDIT',
          amount: requiredMicro,
          currency: 'USDC',
        },
      ],
    });

    req.status = 'PAID';

    const tx: TransactionRecord = {
      transactionId: `tx_merch_${Math.random().toString(36).substring(2, 10)}`,
      userId: params.userId,
      type: 'MERCHANT_PAY',
      status: 'COMPLETED',
      grossAmountMicro: requiredMicro,
      feeAmountMicro: 0,
      netAmountMicro: requiredMicro,
      currency: 'USDC',
      counterparty: req.merchantName,
      description: `Payment to ${req.merchantName}`,
      journalId,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.transactions.unshift(tx);

    return {
      transactionId: tx.transactionId,
      merchantName: req.merchantName,
      amountGhs: req.amountGhs,
      debitedUsdcDisplay: Math.round(requiredUsdc * 100) / 100,
      status: 'COMPLETED',
    };
  }
}

const globalForRails = globalThis as unknown as { railsServiceInstance: GhanaRailsService };
export const ghanaRails = globalForRails.railsServiceInstance || new GhanaRailsService();
if (process.env.NODE_ENV !== 'production') globalForRails.railsServiceInstance = ghanaRails;
