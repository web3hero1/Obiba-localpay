/**
 * Obiba Core Financial Platform — Ghana Local Rails & Bill Fulfillment (PRD §10, §14-§17)
 */

import { EcgBillFulfillment, TransactionRecord } from './types';
import {
  ledger,
  GHS_PER_USDC,
  userAvailableAccount,
  userReservedAccount,
  ASSET_USDC_SETTLEMENT,
  ASSET_GHS_TREASURY,
} from './ledger';

export const GHANA_MOMO_NETWORKS = [
  { id: 'MTN', name: 'MTN Mobile Money' },
  { id: 'TELECEL', name: 'Telecel Cash' },
  { id: 'AT', name: 'AT Money' },
];

class GhanaRailsService {
  private transactions: TransactionRecord[] = [];

  constructor() {
    // Seed initial transaction
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
      description: 'Deposit 1.0 SOL via NEAR Intents',
      journalId: 'jnl_init_01',
      createdAt: Math.floor(Date.now() / 1000) - 3600,
    });
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

    // Settlement
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

    // Generate 20-digit token
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

  // 4. Airtime & Data Bundles
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

  // 5. Obiba Internal Transfers
  public internalTransfer(params: {
    senderId: string;
    recipientId: string;
    amountUsdc: number;
    note?: string;
  }) {
    const micro = Math.round(params.amountUsdc * 1_000_000);
    const balance = ledger.getUserBalance(params.senderId);

    if (balance.availableUsdcMicro < micro) {
      throw new Error('Insufficient available balance for transfer.');
    }

    const journalId = ledger.recordJournal({
      reference: `XFER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      narration: `Internal transfer to ${params.recipientId}: ${params.note || 'P2P'}`,
      entries: [
        {
          accountId: userAvailableAccount(params.senderId),
          direction: 'DEBIT',
          amount: micro,
          currency: 'USDC',
        },
        {
          accountId: userAvailableAccount(params.recipientId),
          direction: 'CREDIT',
          amount: micro,
          currency: 'USDC',
        },
      ],
    });

    const tx: TransactionRecord = {
      transactionId: `tx_xfer_${Math.random().toString(36).substring(2, 10)}`,
      userId: params.senderId,
      type: 'TRANSFER_OUT',
      status: 'COMPLETED',
      grossAmountMicro: micro,
      feeAmountMicro: 0,
      netAmountMicro: micro,
      currency: 'USDC',
      counterparty: params.recipientId,
      description: `Sent $${params.amountUsdc.toFixed(2)} USDC to ${params.recipientId}`,
      journalId,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.transactions.unshift(tx);

    return {
      transactionId: tx.transactionId,
      amountUsdc: params.amountUsdc,
      recipientId: params.recipientId,
      status: 'COMPLETED',
    };
  }
}

const globalForRails = globalThis as unknown as { railsServiceInstance: GhanaRailsService };
export const ghanaRails = globalForRails.railsServiceInstance || new GhanaRailsService();
if (process.env.NODE_ENV !== 'production') globalForRails.railsServiceInstance = ghanaRails;
