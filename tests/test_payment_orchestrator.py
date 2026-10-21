"""
Integration Tests for Obiba Payment Orchestration & NEAR Intents (PRD §35)
"""

import os
import unittest
import tempfile
import uuid

from core.payment_orchestrator import PaymentOrchestrator

class TestPaymentOrchestrator(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.orchestrator = PaymentOrchestrator(db_path=self.db_path)
        self.user_id = f"user_{uuid.uuid4().hex[:6]}"
        self.recipient_id = f"user_{uuid.uuid4().hex[:6]}"

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def test_near_intents_crypto_deposit_lifecycle(self):
        """Test full NEAR Intents 1Click deposit from intent creation to atomic ledger crediting."""
        # 1. Create intent for 0.5 SOL
        intent = self.orchestrator.near_intents.create_deposit_intent(
            user_id=self.user_id,
            asset_symbol="SOL",
            amount_crypto=0.5,
            network="Solana Mainnet"
        )
        self.assertEqual(intent["status"], "AWAITING_DEPOSIT")
        self.assertTrue(intent["deposit_address"].startswith("So1"))

        # 2. Step through solver states
        intent = self.orchestrator.near_intents.step_mock_lifecycle(intent["intent_id"])
        self.assertEqual(intent["status"], "DEPOSIT_DETECTED")

        intent = self.orchestrator.near_intents.step_mock_lifecycle(intent["intent_id"])
        self.assertEqual(intent["status"], "CONVERTING")

        intent = self.orchestrator.near_intents.step_mock_lifecycle(intent["intent_id"])
        self.assertEqual(intent["status"], "SETTLEMENT_VERIFIED")

        # 3. Complete settlement & verify double-entry ledger credit
        res = self.orchestrator.complete_crypto_deposit(intent["intent_id"])
        self.assertEqual(res["status"], "COMPLETED")
        self.assertGreater(res["credited_usdc_micro"], 0)

        balances = self.orchestrator.ledger.get_user_balances(self.user_id)
        self.assertEqual(balances["available_usdc"], res["credited_usdc_micro"])

    def test_internal_transfer_atomic_settlement(self):
        """Test sending money between Obiba accounts."""
        # Fund sender with $100 USDC via MoMo
        self.orchestrator.fund_via_momo(self.user_id, "MTN", "0241234567", 1525.0) # ~100 USDC

        sender_bal_before = self.orchestrator.ledger.get_user_balances(self.user_id)["available_usdc"]

        # Transfer $25 USDC
        res = self.orchestrator.internal_transfer(self.user_id, self.recipient_id, 25.0, "Hackathon prize")
        self.assertEqual(res["status"], "COMPLETED")

        sender_bal_after = self.orchestrator.ledger.get_user_balances(self.user_id)["available_usdc"]
        recipient_bal = self.orchestrator.ledger.get_user_balances(self.recipient_id)["available_usdc"]

        self.assertEqual(sender_bal_before - sender_bal_after, 25000000)
        self.assertEqual(recipient_bal, 25000000)

    def test_overdraft_prevention(self):
        """Test system prevents spending more than available balance."""
        with self.assertRaises(ValueError):
            self.orchestrator.payout_to_momo(self.user_id, "MTN", "0559876543", 500.0)

    def test_ecg_bill_payment_token_generation(self):
        """Test paying an ECG bill debits USDC and returns a 20-digit prepaid token."""
        # Fund user with $50 USDC
        self.orchestrator.fund_via_momo(self.user_id, "MTN", "0241234567", 762.5)

        # Pay GH₵100 ECG Electricity
        res = self.orchestrator.pay_ecg_bill(self.user_id, "4819-2041", 100.0)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertEqual(len(res["token"]), 24) # 20 digits + 4 hyphens (xxxx-xxxx-xxxx-xxxx-xxxx)
        self.assertGreater(res["kwh_units"], 0)

if __name__ == "__main__":
    unittest.main()
