"""
Unit Tests for Obiba Double-Entry Financial Ledger (PRD §22 & §35)
"""

import os
import unittest
import tempfile
import uuid

from core.ledger import (
    DoubleEntryLedger,
    ASSET_USDC_SETTLEMENT,
    user_available_account,
    user_reserved_account,
    REVENUE_CONVERSION_FEES
)

class TestDoubleEntryLedger(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.ledger = DoubleEntryLedger(db_path=self.db_path)
        self.user_id = f"test_user_{uuid.uuid4().hex[:6]}"
        self.ledger.ensure_user_accounts(self.user_id)

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def test_balanced_journal_entry(self):
        """Test recording a valid balanced journal entry."""
        avail_acc = user_available_account(self.user_id)
        entries = [
            {"account_id": ASSET_USDC_SETTLEMENT, "direction": "DEBIT", "amount": 10000000, "currency": "USDC"},
            {"account_id": avail_acc, "direction": "CREDIT", "amount": 10000000, "currency": "USDC"}
        ]
        jnl_id = self.ledger.record_journal("REF-001", "Deposit credit", entries)
        self.assertTrue(jnl_id.startswith("jnl_"))

        # Invariant check
        balances = self.ledger.get_user_balances(self.user_id)
        self.assertEqual(balances["available_usdc"], 10000000) # $10.00 USDC
        self.assertEqual(balances["reserved_usdc"], 0)

        custody_bal = self.ledger.get_account_balance(ASSET_USDC_SETTLEMENT)
        self.assertEqual(custody_bal, 10000000)

    def test_unbalanced_journal_rejected(self):
        """Test that unbalanced debits and credits raise ValueError."""
        avail_acc = user_available_account(self.user_id)
        unbalanced = [
            {"account_id": ASSET_USDC_SETTLEMENT, "direction": "DEBIT", "amount": 10000000, "currency": "USDC"},
            {"account_id": avail_acc, "direction": "CREDIT", "amount": 9000000, "currency": "USDC"}
        ]
        with self.assertRaises(ValueError):
            self.ledger.record_journal("REF-FAIL", "Unbalanced", unbalanced)

    def test_idempotency_prevents_duplicate_posting(self):
        """Test that re-submitting with the same idempotency key does not duplicate entries."""
        avail_acc = user_available_account(self.user_id)
        entries = [
            {"account_id": ASSET_USDC_SETTLEMENT, "direction": "DEBIT", "amount": 5000000, "currency": "USDC"},
            {"account_id": avail_acc, "direction": "CREDIT", "amount": 5000000, "currency": "USDC"}
        ]
        idem_key = "idem_unique_test_123"

        jnl_1 = self.ledger.record_journal("REF-IDEM", "First attempt", entries, idempotency_key=idem_key)
        jnl_2 = self.ledger.record_journal("REF-IDEM", "Second attempt", entries, idempotency_key=idem_key)

        self.assertEqual(jnl_1, jnl_2)
        balances = self.ledger.get_user_balances(self.user_id)
        self.assertEqual(balances["available_usdc"], 5000000) # Exactly once

    def test_funds_hold_and_release(self):
        """Test available balance drops when funds are reserved for payout."""
        avail_acc = user_available_account(self.user_id)
        res_acc = user_reserved_account(self.user_id)

        # Initial deposit: $50 USDC
        self.ledger.record_journal("INIT", "Deposit", [
            {"account_id": ASSET_USDC_SETTLEMENT, "direction": "DEBIT", "amount": 50000000, "currency": "USDC"},
            {"account_id": avail_acc, "direction": "CREDIT", "amount": 50000000, "currency": "USDC"}
        ])

        # Hold: $20 USDC
        self.ledger.record_journal("HOLD", "Hold for Payout", [
            {"account_id": avail_acc, "direction": "DEBIT", "amount": 20000000, "currency": "USDC"},
            {"account_id": res_acc, "direction": "CREDIT", "amount": 20000000, "currency": "USDC"}
        ])

        balances = self.ledger.get_user_balances(self.user_id)
        self.assertEqual(balances["available_usdc"], 30000000) # $30
        self.assertEqual(balances["reserved_usdc"], 20000000)  # $20
        self.assertEqual(balances["total_posted_usdc"], 50000000) # $50

if __name__ == "__main__":
    unittest.main()
