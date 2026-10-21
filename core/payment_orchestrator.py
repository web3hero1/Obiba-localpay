"""
Obiba Financial Core — Payment Orchestration Engine (PRD §25)

Coordinates high-level business flows:
1. Crypto Deposits (via NEAR Intents 1Click)
2. Mobile Money Funding (GHS -> USDC)
3. Internal Obiba-to-Obiba Transfers
4. Mobile Money Outbound Payouts
5. Utility & Everyday Bill Payments (ECG Electricity, Airtime, Data)

Enforces:
- Atomic double-entry ledger postings (Sum Debits = Sum Credits)
- Balance reservation and release (Funds Held -> Settled or Reversed)
- Idempotency and replay prevention
"""

import sqlite3
import time
import uuid
from typing import Dict, List, Optional

from core.ledger import (
    DoubleEntryLedger,
    ASSET_USDC_SETTLEMENT,
    ASSET_GHS_TREASURY,
    REVENUE_CONVERSION_FEES,
    REVENUE_SERVICE_FEES,
    user_available_account,
    user_reserved_account
)
from core.quotes import QuoteService
from adapters.near_intents import NearIntentsAdapter
from adapters.ghana_rails import GhanaRailsAdapter

class PaymentOrchestrator:
    def __init__(self, db_path: str = "obiba.db"):
        self.db_path = db_path
        self.ledger = DoubleEntryLedger(db_path=db_path)
        self.quote_service = QuoteService()
        self.near_intents = NearIntentsAdapter()
        self.ghana_rails = GhanaRailsAdapter()
        self._init_tx_tables()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init_tx_tables(self):
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                status TEXT NOT NULL,
                gross_amount INTEGER NOT NULL,
                fee_amount INTEGER NOT NULL,
                net_amount INTEGER NOT NULL,
                currency TEXT NOT NULL,
                counterparty TEXT,
                description TEXT NOT NULL,
                metadata_json TEXT,
                journal_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
            """)

    def complete_crypto_deposit(self, intent_id: str) -> Dict:
        """
        Executes atomic settlement for a NEAR Intents deposit.
        Moves funds from ASSET:SETTLEMENT:USDC -> LIABILITY:USER_AVAILABLE:<user_id>
        """
        intent = self.near_intents.get_intent_status(intent_id)
        if intent["status"] == "CREDITED":
            return {"status": "ALREADY_CREDITED", "intent": intent}

        user_id = intent["user_id"]
        net_usdc_micro = intent["estimated_usdc_micro"]
        # Calculate gross & fee
        fee_usdc_micro = int(round(net_usdc_micro * 0.005))
        gross_usdc_micro = net_usdc_micro + fee_usdc_micro

        journal_ref = f"DEP-NEAR-{intent_id}"
        narration = f"Deposit via NEAR Intents: {intent['source_amount']} {intent['source_asset']} ({intent['network']})"

        # Double-entry entries:
        # DEBIT ASSET_USDC_SETTLEMENT (gross)
        # CREDIT user_available_account(user_id) (net)
        # CREDIT REVENUE_CONVERSION_FEES (fee)
        entries = [
            {
                "account_id": ASSET_USDC_SETTLEMENT,
                "direction": "DEBIT",
                "amount": gross_usdc_micro,
                "currency": "USDC"
            },
            {
                "account_id": user_available_account(user_id),
                "direction": "CREDIT",
                "amount": net_usdc_micro,
                "currency": "USDC"
            },
            {
                "account_id": REVENUE_CONVERSION_FEES,
                "direction": "CREDIT",
                "amount": fee_usdc_micro,
                "currency": "USDC"
            }
        ]

        journal_id = self.ledger.record_journal(
            reference=journal_ref,
            narration=narration,
            entries=entries,
            idempotency_key=f"idem_dep_{intent_id}"
        )

        intent["status"] = "CREDITED"

        tx_id = f"tx_cr_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        with self._get_connection() as conn:
            conn.execute("""
            INSERT INTO transactions (
                transaction_id, user_id, transaction_type, status,
                gross_amount, fee_amount, net_amount, currency,
                counterparty, description, metadata_json, journal_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id, user_id, "CRYPTO_DEPOSIT", "COMPLETED",
                gross_usdc_micro, fee_usdc_micro, net_usdc_micro, "USDC",
                f"NEAR Intents ({intent['source_asset']})",
                narration,
                str(intent),
                journal_id,
                now, now
            ))

        return {
            "transaction_id": tx_id,
            "status": "COMPLETED",
            "journal_id": journal_id,
            "credited_usdc_micro": net_usdc_micro,
            "credited_usdc_display": round(net_usdc_micro / 10**6, 2)
        }

    def fund_via_momo(
        self,
        user_id: str,
        provider: str,
        phone: str,
        amount_ghs: float,
        idempotency_key: Optional[str] = None
    ) -> Dict:
        """
        Ghana MoMo cash-in: simulates USSD collection, converts GHS -> USDC,
        and credits customer ledger.
        """
        # Step 1: Simulate collection
        collection = self.ghana_rails.simulate_momo_collection(provider, phone, amount_ghs)

        # Step 2: Get conversion quote
        quote = self.quote_service.get_ghs_to_usdc_quote(amount_ghs)
        net_usdc_micro = quote["net_usdc_micro"]

        # Step 3: Atomic ledger credit
        journal_ref = f"MOMO-IN-{collection['collection_id']}"
        narration = f"Mobile Money deposit from {phone} ({provider}) GH₵{amount_ghs:.2f}"

        entries = [
            {
                "account_id": ASSET_USDC_SETTLEMENT,
                "direction": "DEBIT",
                "amount": net_usdc_micro,
                "currency": "USDC"
            },
            {
                "account_id": user_available_account(user_id),
                "direction": "CREDIT",
                "amount": net_usdc_micro,
                "currency": "USDC"
            }
        ]

        journal_id = self.ledger.record_journal(
            reference=journal_ref,
            narration=narration,
            entries=entries,
            idempotency_key=idempotency_key or f"idem_momo_{collection['collection_id']}"
        )

        tx_id = f"tx_momo_in_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        with self._get_connection() as conn:
            conn.execute("""
            INSERT INTO transactions (
                transaction_id, user_id, transaction_type, status,
                gross_amount, fee_amount, net_amount, currency,
                counterparty, description, metadata_json, journal_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id, user_id, "MOMO_DEPOSIT", "COMPLETED",
                net_usdc_micro, 0, net_usdc_micro, "USDC",
                f"{provider} ({phone})",
                narration,
                str(collection),
                journal_id,
                now, now
            ))

        return {
            "transaction_id": tx_id,
            "status": "COMPLETED",
            "journal_id": journal_id,
            "amount_ghs": amount_ghs,
            "credited_usdc_micro": net_usdc_micro,
            "credited_usdc_display": quote["net_usdc_display"]
        }

    def internal_transfer(
        self,
        sender_id: str,
        recipient_id: str,
        amount_usdc: float,
        note: Optional[str] = None
    ) -> Dict:
        """
        Instant Obiba-to-Obiba transfer between two registered users.
        Atomic double-entry transfer.
        """
        amount_micro = int(round(amount_usdc * 10**6))
        if amount_micro <= 0:
            raise ValueError("Transfer amount must be positive.")

        # Check sender available balance
        balances = self.ledger.get_user_balances(sender_id)
        if balances["available_usdc"] < amount_micro:
            raise ValueError(
                f"Insufficient funds: available ${balances['available_usdc']/10**6:.2f} USDC, needed ${amount_usdc:.2f} USDC."
            )

        self.ledger.ensure_user_accounts(recipient_id)

        journal_ref = f"TRANSFER-{uuid.uuid4().hex[:10]}"
        narration = f"Obiba transfer to {recipient_id}: {note or 'P2P Payment'}"

        entries = [
            {
                "account_id": user_available_account(sender_id),
                "direction": "DEBIT",
                "amount": amount_micro,
                "currency": "USDC"
            },
            {
                "account_id": user_available_account(recipient_id),
                "direction": "CREDIT",
                "amount": amount_micro,
                "currency": "USDC"
            }
        ]

        journal_id = self.ledger.record_journal(
            reference=journal_ref,
            narration=narration,
            entries=entries
        )

        now = int(time.time())
        tx_id_sender = f"tx_send_{uuid.uuid4().hex[:10]}"
        tx_id_recv = f"tx_recv_{uuid.uuid4().hex[:10]}"

        with self._get_connection() as conn:
            conn.execute("""
            INSERT INTO transactions (
                transaction_id, user_id, transaction_type, status,
                gross_amount, fee_amount, net_amount, currency,
                counterparty, description, journal_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id_sender, sender_id, "TRANSFER_OUT", "COMPLETED",
                amount_micro, 0, amount_micro, "USDC",
                recipient_id, f"Sent to {recipient_id}", journal_id, now, now
            ))
            conn.execute("""
            INSERT INTO transactions (
                transaction_id, user_id, transaction_type, status,
                gross_amount, fee_amount, net_amount, currency,
                counterparty, description, journal_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id_recv, recipient_id, "TRANSFER_IN", "COMPLETED",
                amount_micro, 0, amount_micro, "USDC",
                sender_id, f"Received from {sender_id}", journal_id, now, now
            ))

        return {
            "transaction_id": tx_id_sender,
            "status": "COMPLETED",
            "journal_id": journal_id,
            "amount_usdc": amount_usdc,
            "recipient_id": recipient_id
        }

    def payout_to_momo(
        self,
        user_id: str,
        provider: str,
        recipient_phone: str,
        amount_ghs: float
    ) -> Dict:
        """
        Sends money from customer USDC balance to recipient's Ghana Mobile Money.
        Two-phase commit:
        1. Reserve customer USDC (Hold)
        2. Execute payout via local rails
        3. Clear reserved funds and debit treasury
        """
        quote = self.quote_service.get_usdc_to_ghs_quote(amount_ghs, payout_type="MOMO")
        required_usdc_micro = quote["required_usdc_micro"]

        # Check available balance
        balances = self.ledger.get_user_balances(user_id)
        if balances["available_usdc"] < required_usdc_micro:
            raise ValueError(
                f"Insufficient balance. Required: ${required_usdc_micro/10**6:.2f} USDC (GH₵{amount_ghs:.2f}), "
                f"Available: ${balances['available_usdc']/10**6:.2f} USDC."
            )

        # Phase 1: Hold (Reserve funds)
        hold_ref = f"HOLD-MOMO-{uuid.uuid4().hex[:10]}"
        hold_entries = [
            {
                "account_id": user_available_account(user_id),
                "direction": "DEBIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            },
            {
                "account_id": user_reserved_account(user_id),
                "direction": "CREDIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            }
        ]
        self.ledger.record_journal(
            reference=hold_ref,
            narration=f"Hold for MoMo payout to {recipient_phone} GH₵{amount_ghs:.2f}",
            entries=hold_entries
        )

        # Phase 2: Execute payout on local rail
        payout_res = self.ghana_rails.simulate_momo_payout(provider, recipient_phone, amount_ghs)

        # Phase 3: Final settlement (Clear hold)
        settle_ref = f"SETTLE-MOMO-{payout_res['payout_id']}"
        settle_entries = [
            {
                "account_id": user_reserved_account(user_id),
                "direction": "DEBIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            },
            {
                "account_id": ASSET_USDC_SETTLEMENT,
                "direction": "CREDIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            }
        ]
        journal_id = self.ledger.record_journal(
            reference=settle_ref,
            narration=f"Settled MoMo payout to {recipient_phone} ({provider}) GH₵{amount_ghs:.2f}",
            entries=settle_entries
        )

        tx_id = f"tx_payout_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        with self._get_connection() as conn:
            conn.execute("""
            INSERT INTO transactions (
                transaction_id, user_id, transaction_type, status,
                gross_amount, fee_amount, net_amount, currency,
                counterparty, description, metadata_json, journal_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id, user_id, "MOMO_PAYOUT", "COMPLETED",
                required_usdc_micro, 0, required_usdc_micro, "USDC",
                f"{provider} ({recipient_phone})",
                f"Paid GH₵{amount_ghs:.2f} to {recipient_phone}",
                str(payout_res),
                journal_id,
                now, now
            ))

        return {
            "transaction_id": tx_id,
            "status": "COMPLETED",
            "journal_id": journal_id,
            "amount_ghs": amount_ghs,
            "debited_usdc_display": quote["required_usdc_display"],
            "recipient_phone": recipient_phone,
            "provider": provider,
            "receipt": payout_res
        }

    def pay_ecg_bill(
        self,
        user_id: str,
        meter_number: str,
        amount_ghs: float
    ) -> Dict:
        """
        Pays ECG electricity bill from customer USDC balance and returns prepaid 20-digit token.
        """
        quote = self.quote_service.get_usdc_to_ghs_quote(amount_ghs, payout_type="BILL")
        required_usdc_micro = quote["required_usdc_micro"]

        balances = self.ledger.get_user_balances(user_id)
        if balances["available_usdc"] < required_usdc_micro:
            raise ValueError(
                f"Insufficient balance. Required: ${required_usdc_micro/10**6:.2f} USDC (GH₵{amount_ghs:.2f}), "
                f"Available: ${balances['available_usdc']/10**6:.2f} USDC."
            )

        # Execute bill fulfillment
        ecg_res = self.ghana_rails.fulfill_ecg_bill(meter_number, amount_ghs)

        # Post settlement journal entry
        settle_ref = f"BILL-ECG-{ecg_res['receipt_number']}"
        entries = [
            {
                "account_id": user_available_account(user_id),
                "direction": "DEBIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            },
            {
                "account_id": ASSET_USDC_SETTLEMENT,
                "direction": "CREDIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            }
        ]
        journal_id = self.ledger.record_journal(
            reference=settle_ref,
            narration=f"ECG Electricity payment for meter {meter_number} GH₵{amount_ghs:.2f}",
            entries=entries
        )

        tx_id = f"tx_bill_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        with self._get_connection() as conn:
            conn.execute("""
            INSERT INTO transactions (
                transaction_id, user_id, transaction_type, status,
                gross_amount, fee_amount, net_amount, currency,
                counterparty, description, metadata_json, journal_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id, user_id, "BILL_PAYMENT", "COMPLETED",
                required_usdc_micro, 0, required_usdc_micro, "USDC",
                f"ECG ({meter_number})",
                f"Electricity token purchase for {meter_number}",
                str(ecg_res),
                journal_id,
                now, now
            ))

        return {
            "transaction_id": tx_id,
            "status": "COMPLETED",
            "journal_id": journal_id,
            "meter_number": meter_number,
            "amount_ghs": amount_ghs,
            "kwh_units": ecg_res["kwh_units"],
            "token": ecg_res["token"],
            "customer_name": ecg_res["customer_name"],
            "debited_usdc_display": quote["required_usdc_display"],
            "receipt": ecg_res
        }

    def buy_airtime_or_data(
        self,
        user_id: str,
        category: str, # "AIRTIME" or "DATA"
        provider: str,
        phone: str,
        amount_ghs: float,
        bundle_id: Optional[str] = None
    ) -> Dict:
        """Fulfills airtime or data bundles from USDC balance."""
        quote = self.quote_service.get_usdc_to_ghs_quote(amount_ghs, payout_type="BILL")
        required_usdc_micro = quote["required_usdc_micro"]

        balances = self.ledger.get_user_balances(user_id)
        if balances["available_usdc"] < required_usdc_micro:
            raise ValueError(
                f"Insufficient balance. Required: ${required_usdc_micro/10**6:.2f} USDC, "
                f"Available: ${balances['available_usdc']/10**6:.2f} USDC."
            )

        if category == "AIRTIME":
            fulfillment = self.ghana_rails.fulfill_airtime(provider, phone, amount_ghs)
        else:
            fulfillment = self.ghana_rails.fulfill_data_bundle(bundle_id or "mtn_1gb", phone)

        settle_ref = f"{category}-{fulfillment['receipt_number']}"
        entries = [
            {
                "account_id": user_available_account(user_id),
                "direction": "DEBIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            },
            {
                "account_id": ASSET_USDC_SETTLEMENT,
                "direction": "CREDIT",
                "amount": required_usdc_micro,
                "currency": "USDC"
            }
        ]
        journal_id = self.ledger.record_journal(
            reference=settle_ref,
            narration=f"{category} purchase for {phone} ({provider}) GH₵{amount_ghs:.2f}",
            entries=entries
        )

        tx_id = f"tx_{category.lower()}_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        with self._get_connection() as conn:
            conn.execute("""
            INSERT INTO transactions (
                transaction_id, user_id, transaction_type, status,
                gross_amount, fee_amount, net_amount, currency,
                counterparty, description, metadata_json, journal_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id, user_id, category, "COMPLETED",
                required_usdc_micro, 0, required_usdc_micro, "USDC",
                f"{provider} ({phone})",
                f"{category} recharge for {phone}",
                str(fulfillment),
                journal_id,
                now, now
            ))

        return {
            "transaction_id": tx_id,
            "status": "COMPLETED",
            "journal_id": journal_id,
            "category": category,
            "phone": phone,
            "amount_ghs": amount_ghs,
            "debited_usdc_display": quote["required_usdc_display"],
            "receipt": fulfillment
        }

    def get_user_transactions(self, user_id: str, limit: int = 50) -> List[Dict]:
        with self._get_connection() as conn:
            cur = conn.execute("""
            SELECT transaction_id, transaction_type, status, gross_amount, fee_amount,
                   net_amount, currency, counterparty, description, journal_id, created_at
            FROM transactions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """, (user_id, limit))
            return [dict(r) for r in cur.fetchall()]
