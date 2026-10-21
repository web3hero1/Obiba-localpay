-- ==============================================================================
-- OBIBA CORE FINANCIAL PLATFORM — SUPABASE POSTGRESQL SCHEMA (PRD §22 & §26)
-- Architecture: Immutable Double-Entry Financial Ledger & NEAR Intents Gateway
-- Precision: All monetary values in integer minor units (USDC: 6 decimals, GHS: 2 decimals)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS & IDENTITY
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    country_code VARCHAR(2) NOT NULL DEFAULT 'GH',
    kyc_status VARCHAR(30) NOT NULL DEFAULT 'VERIFIED' CHECK (kyc_status IN ('REGISTERED', 'VERIFICATION_PENDING', 'VERIFIED', 'RESTRICTED', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CHART OF ACCOUNTS (COA)
CREATE TABLE IF NOT EXISTS accounts (
    account_id VARCHAR(100) PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('USDC', 'GHS')),
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user account queries
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);

-- 4. FINANCIAL JOURNALS (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS journals (
    journal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(120) NOT NULL,
    narration TEXT NOT NULL,
    idempotency_key VARCHAR(120) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journals_ref ON journals(reference);
CREATE INDEX IF NOT EXISTS idx_journals_created ON journals(created_at DESC);

-- 5. LEDGER ENTRIES (SUM DEBITS MUST EQUAL SUM CREDITS)
CREATE TABLE IF NOT EXISTS entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID NOT NULL REFERENCES journals(journal_id) ON DELETE RESTRICT,
    account_id VARCHAR(100) NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_journal ON entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id);

-- 6. NEAR INTENTS 1CLICK CONVERSION ORDERS
CREATE TABLE IF NOT EXISTS deposit_intents (
    intent_id VARCHAR(60) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    source_asset VARCHAR(20) NOT NULL,
    source_amount NUMERIC(28, 8) NOT NULL CHECK (source_amount > 0),
    network VARCHAR(50) NOT NULL,
    deposit_address VARCHAR(120) NOT NULL,
    destination_asset VARCHAR(20) NOT NULL DEFAULT 'USDC',
    estimated_usdc_micro BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AWAITING_DEPOSIT' CHECK (status IN (
        'AWAITING_DEPOSIT',
        'DEPOSIT_DETECTED',
        'CONVERTING',
        'SETTLEMENT_VERIFIED',
        'CREDITED',
        'REFUND_PENDING',
        'REFUNDED',
        'FAILED'
    )),
    solver_name VARCHAR(100) NOT NULL,
    deposit_tx_hash VARCHAR(120),
    settlement_tx_hash VARCHAR(120),
    refund_address VARCHAR(120),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_user ON deposit_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_intents(status);

-- 7. CUSTOMER TRANSACTIONS & RECEIPTS
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id VARCHAR(60) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'CRYPTO_DEPOSIT',
        'MOMO_DEPOSIT',
        'MOMO_PAYOUT',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'BILL_PAYMENT',
        'AIRTIME',
        'DATA',
        'MERCHANT_PAY'
    )),
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
    gross_amount BIGINT NOT NULL,
    fee_amount BIGINT NOT NULL DEFAULT 0,
    net_amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    counterparty VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    journal_id UUID REFERENCES journals(journal_id),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

-- 8. SYSTEM ACCOUNTS INITIALIZATION
INSERT INTO accounts (account_id, currency, account_type, description)
VALUES 
    ('1000:ASSET:SETTLEMENT:USDC', 'USDC', 'ASSET', 'NEAR Intents 1Click Custody & Settlement Vault'),
    ('1010:ASSET:TREASURY:GHS', 'GHS', 'ASSET', 'Ghana Local MoMo & Biller Payout Treasury'),
    ('4000:REVENUE:CONVERSION_FEES', 'USDC', 'REVENUE', 'Obiba Crypto-to-USDC Conversion & FX Revenue'),
    ('4010:REVENUE:SERVICE_FEES', 'USDC', 'REVENUE', 'Obiba Local Payout & Bill Payment Service Fees')
ON CONFLICT (account_id) DO NOTHING;
