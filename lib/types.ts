/**
 * Obiba Core Financial Platform — TypeScript Type Definitions (PRD v1.0)
 */

export type Currency = 'USDC' | 'GHS';

export interface UserAccount {
  userId: string;
  name: string;
  phone: string;
  kycStatus: 'REGISTERED' | 'VERIFICATION_PENDING' | 'VERIFIED' | 'RESTRICTED';
  country: string;
}

export interface UserBalance {
  userId: string;
  primaryCurrency: 'USDC';
  availableUsdcMicro: number; // 6 decimals (1 USDC = 1,000,000 micro-USDC)
  availableUsdc: number;      // Floating display representation
  reservedUsdcMicro: number;  // Funds held for pending payouts/bills
  reservedUsdc: number;
  totalPostedUsdc: number;
  indicativeGhsEquivalent: number;
  fxRateGhsPerUsdc: number;
}

export type JournalDirection = 'DEBIT' | 'CREDIT';

export interface LedgerEntry {
  entryId: string;
  journalId: string;
  accountId: string;
  direction: JournalDirection;
  amount: number; // Integer minor units
  currency: Currency;
  createdAt: number;
}

export interface LedgerJournal {
  journalId: string;
  reference: string;
  narration: string;
  idempotencyKey?: string;
  createdAt: number;
  entries: LedgerEntry[];
}

export interface NearIntentsAsset {
  symbol: string;
  name: string;
  chain: string;
  icon: string;
  minDeposit: number;
  contractAddress: string;
  networks: string[];
  testnetNetworks: string[];
  mainnetNetworks: string[];
}

export type DepositStatus =
  | 'AWAITING_DEPOSIT'
  | 'DEPOSIT_DETECTED'
  | 'CONVERTING'
  | 'SETTLEMENT_VERIFIED'
  | 'CREDITED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'FAILED';

export interface DepositIntent {
  intentId: string;
  userId: string;
  environment: 'testnet' | 'mainnet';
  sourceAsset: string;
  sourceAmount: number;
  network: string;
  depositAddress: string;
  destinationAsset: string;
  estimatedUsdcMicro: number;
  estimatedUsdcDisplay: number;
  status: DepositStatus;
  solverInfo: {
    solverName: string;
    executionSpeed: string;
    route: string;
    refundAddress?: string;
  };
  depositTxHash?: string;
  settlementTxHash?: string;
  createdAt: number;
  expiresAt: number;
}

export interface TransactionRecord {
  transactionId: string;
  userId: string;
  type:
    | 'CRYPTO_DEPOSIT'
    | 'MOMO_DEPOSIT'
    | 'MOMO_PAYOUT'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
    | 'BILL_PAYMENT'
    | 'AIRTIME'
    | 'DATA'
    | 'MERCHANT_PAY';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  grossAmountMicro: number;
  feeAmountMicro: number;
  netAmountMicro: number;
  currency: Currency;
  counterparty: string;
  description: string;
  journalId: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface EcgBillFulfillment {
  biller: string;
  meterNumber: string;
  customerName: string;
  amountGhs: number;
  kwhUnits: number;
  token: string; // 20-digit prepaid code (xxxx-xxxx-xxxx-xxxx-xxxx)
  receiptNumber: string;
  timestamp: number;
  instructions: string;
}
