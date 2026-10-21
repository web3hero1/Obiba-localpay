"""
Obiba Financial Core — Application & API Server (PRD §27)

Zero-dependency HTTP Server exposing the complete Obiba API and serving
the mobile-first Obiba web interface and Hackathon Inspector.
"""

import json
import os
import sys
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from typing import Dict, Any

from core.ledger import DoubleEntryLedger
from core.quotes import QuoteService, GHS_PER_USDC
from core.payment_orchestrator import PaymentOrchestrator
from adapters.near_intents import NearIntentsAdapter
from adapters.ghana_rails import GHANA_MOMO_PROVIDERS, GHANA_BANKS, DATA_BUNDLES

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "obiba.db")

orchestrator = PaymentOrchestrator(db_path=DB_PATH)
quote_service = QuoteService()
near_intents = NearIntentsAdapter()

class ObibaAPIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def _send_json(self, data: Any, status: int = 200):
        response_bytes = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, Authorization")
        self.end_headers()
        self.wfile.write(response_bytes)

    def _read_body_json(self) -> Dict:
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Static assets
        if not path.startswith("/api/"):
            return super().do_GET()

        try:
            # 1. Wallet Balance
            if path == "/api/v1/wallet":
                user_id = "user_gh_founder" # Default demo user
                balances = orchestrator.ledger.get_user_balances(user_id)
                avail_usdc = balances["available_usdc"] / 10**6
                res_usdc = balances["reserved_usdc"] / 10**6
                ghs_equiv = avail_usdc * GHS_PER_USDC

                self._send_json({
                    "user_id": user_id,
                    "primary_currency": "USDC",
                    "available_usdc": avail_usdc,
                    "available_usdc_micro": balances["available_usdc"],
                    "reserved_usdc": res_usdc,
                    "indicative_ghs_equivalent": round(ghs_equiv, 2),
                    "fx_rate_ghs_per_usdc": GHS_PER_USDC
                })

            # 2. Transaction History
            elif path == "/api/v1/wallet/transactions":
                user_id = "user_gh_founder"
                txs = orchestrator.get_user_transactions(user_id)
                self._send_json({"transactions": txs})

            # 3. Supported Crypto Assets (NEAR Intents)
            elif path == "/api/v1/crypto/assets":
                assets = near_intents.get_supported_assets()
                self._send_json({"assets": assets})

            # 4. Ghana Providers catalogue
            elif path == "/api/v1/ghana/catalogue":
                self._send_json({
                    "momo_providers": GHANA_MOMO_PROVIDERS,
                    "banks": GHANA_BANKS,
                    "data_bundles": DATA_BUNDLES
                })

            # 5. Admin / Hackathon Inspector: Double-entry audit ledger
            elif path == "/api/v1/admin/ledger":
                journals = orchestrator.ledger.get_recent_journals(limit=50)
                # Also include system balances
                custody_usdc = orchestrator.ledger.get_account_balance("1000:ASSET:SETTLEMENT:USDC") / 10**6
                rev_conv = orchestrator.ledger.get_account_balance("4000:REVENUE:CONVERSION_FEES") / 10**6
                self._send_json({
                    "custody_usdc_pool": custody_usdc,
                    "fee_revenue_usdc": rev_conv,
                    "total_journals": len(journals),
                    "journals": journals
                })

            else:
                self._send_json({"error": "Endpoint not found"}, status=404)

        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_body_json()

        try:
            # 1. Login
            if path == "/api/v1/auth/login":
                phone = body.get("phone", "+233241234567")
                self._send_json({
                    "token": "demo_jwt_token_obiba",
                    "user": {
                        "user_id": "user_gh_founder",
                        "name": "Kwame Mensah",
                        "phone": phone,
                        "kyc_status": "VERIFIED",
                        "country": "GH"
                    }
                })

            # 2. Crypto Deposit Quote
            elif path == "/api/v1/crypto/deposits/quotes":
                asset = body.get("asset", "SOL")
                amount = float(body.get("amount", 1.0))
                quote = quote_service.get_crypto_to_usdc_quote(asset, amount)
                self._send_json(quote)

            # 3. Create NEAR Intents Deposit Intent
            elif path == "/api/v1/crypto/deposits":
                user_id = "user_gh_founder"
                asset = body.get("asset", "SOL")
                amount = float(body.get("amount", 1.0))
                network = body.get("network", "Solana Mainnet")
                intent = near_intents.create_deposit_intent(user_id, asset, amount, network)
                self._send_json(intent)

            # 4. Step Simulation / Status
            elif path == "/api/v1/crypto/deposits/step":
                intent_id = body.get("intent_id")
                intent = near_intents.step_mock_lifecycle(intent_id)
                # If it reached SETTLEMENT_VERIFIED or CREDITED, trigger atomic ledger credit
                if intent["status"] == "SETTLEMENT_VERIFIED":
                    res = orchestrator.complete_crypto_deposit(intent_id)
                    intent = near_intents.get_intent_status(intent_id)
                self._send_json(intent)

            # 5. Mobile Money Cash-In
            elif path == "/api/v1/funding/momo":
                user_id = "user_gh_founder"
                provider = body.get("provider", "MTN")
                phone = body.get("phone", "0241234567")
                amount_ghs = float(body.get("amount_ghs", 100.0))
                res = orchestrator.fund_via_momo(user_id, provider, phone, amount_ghs)
                self._send_json(res)

            # 6. Obiba P2P Transfer
            elif path == "/api/v1/transfers":
                sender_id = "user_gh_founder"
                recipient_id = body.get("recipient_id", "user_abena")
                amount_usdc = float(body.get("amount_usdc", 10.0))
                note = body.get("note", "Lunch")
                res = orchestrator.internal_transfer(sender_id, recipient_id, amount_usdc, note)
                self._send_json(res)

            # 7. Outbound MoMo Payout
            elif path == "/api/v1/payouts/momo":
                user_id = "user_gh_founder"
                provider = body.get("provider", "MTN")
                phone = body.get("phone", "0559876543")
                amount_ghs = float(body.get("amount_ghs", 50.0))
                res = orchestrator.payout_to_momo(user_id, provider, phone, amount_ghs)
                self._send_json(res)

            # 8. ECG Meter Validation
            elif path == "/api/v1/bills/ecg/validate":
                meter_number = body.get("meter_number", "482019-2041")
                res = orchestrator.ghana_rails.validate_meter_number(meter_number)
                self._send_json(res)

            # 9. ECG Electricity Payment
            elif path == "/api/v1/bills/ecg/pay":
                user_id = "user_gh_founder"
                meter_number = body.get("meter_number", "482019-2041")
                amount_ghs = float(body.get("amount_ghs", 100.0))
                res = orchestrator.pay_ecg_bill(user_id, meter_number, amount_ghs)
                self._send_json(res)

            # 10. Airtime / Data Recharge
            elif path == "/api/v1/bills/recharge":
                user_id = "user_gh_founder"
                category = body.get("category", "AIRTIME")
                provider = body.get("provider", "MTN")
                phone = body.get("phone", "0241234567")
                amount_ghs = float(body.get("amount_ghs", 20.0))
                bundle_id = body.get("bundle_id")
                res = orchestrator.buy_airtime_or_data(user_id, category, provider, phone, amount_ghs, bundle_id)
                self._send_json(res)

            else:
                self._send_json({"error": "Endpoint not found"}, status=404)

        except Exception as e:
            self._send_json({"error": str(e)}, status=400)

def run_server(port: int = 8080):
    os.makedirs(STATIC_DIR, exist_ok=True)
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, ObibaAPIHandler)
    print(f"🚀 Obiba LocalPay server running at http://127.0.0.1:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)
