"""
Obiba Financial Core — Central Quote Service (PRD §24)

Handles deterministic currency exchange and conversion rates:
- Crypto to USDC (powered by NEAR Intents pricing)
- GHS to USDC (Mobile Money funding)
- USDC to GHS (Mobile Money payouts, Bill Payments, Merchant)
"""

import time
import uuid
from typing import Dict, Optional

# Baseline reference prices in USD
CRYPTO_USD_RATES = {
    "BTC": 67500.00,
    "ETH": 2650.00,
    "SOL": 165.00,
    "NEAR": 4.85,
    "USDT": 1.00,
    "USDC": 1.00
}

# FX Baseline: 1 USDC = 15.25 GHS
GHS_PER_USDC = 15.25
USDC_DECIMALS = 6
GHS_DECIMALS = 2

class QuoteService:
    def __init__(self, quote_validity_seconds: int = 300):
        self.validity_seconds = quote_validity_seconds
        self.quotes_cache: Dict[str, Dict] = {}

    def get_crypto_to_usdc_quote(
        self,
        asset_symbol: str,
        amount_crypto: float,
        slippage_bps: int = 50 # 0.5%
    ) -> Dict:
        """
        Quotes crypto input -> USDC credit.
        All monetary amounts returned in micro-units for precision.
        """
        symbol = asset_symbol.upper()
        if symbol not in CRYPTO_USD_RATES:
            raise ValueError(f"Asset {symbol} is not currently supported.")

        rate = CRYPTO_USD_RATES[symbol]
        gross_usd = amount_crypto * rate
        # 0.5% Obiba conversion & protocol fee
        fee_rate = 0.005
        fee_usd = gross_usd * fee_rate
        net_usdc = max(0.0, gross_usd - fee_usd)

        gross_usdc_micro = int(round(gross_usd * 10**USDC_DECIMALS))
        fee_usdc_micro = int(round(fee_usd * 10**USDC_DECIMALS))
        net_usdc_micro = gross_usdc_micro - fee_usdc_micro

        quote_id = f"qte_cr_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        expires_at = now + self.validity_seconds

        quote_data = {
            "quote_id": quote_id,
            "quote_type": "CRYPTO_TO_USDC",
            "source_asset": symbol,
            "source_amount": amount_crypto,
            "destination_asset": "USDC",
            "gross_usdc_micro": gross_usdc_micro,
            "fee_usdc_micro": fee_usdc_micro,
            "net_usdc_micro": net_usdc_micro,
            "net_usdc_display": round(net_usdc, 2),
            "effective_rate": rate,
            "slippage_bps": slippage_bps,
            "created_at": now,
            "expires_at": expires_at,
            "expired": False
        }
        self.quotes_cache[quote_id] = quote_data
        return quote_data

    def get_ghs_to_usdc_quote(self, amount_ghs: float) -> Dict:
        """
        Quotes GHS MoMo funding -> USDC balance credit.
        """
        if amount_ghs < 5.0:
            raise ValueError("Minimum funding is GH₵5.00.")

        # Telecom collection fee: 1%
        collection_fee_ghs = amount_ghs * 0.01
        net_ghs_to_convert = amount_ghs - collection_fee_ghs

        # Conversion to USDC
        gross_usdc = net_ghs_to_convert / GHS_PER_USDC
        net_usdc_micro = int(round(gross_usdc * 10**USDC_DECIMALS))

        quote_id = f"qte_ghs_in_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        expires_at = now + self.validity_seconds

        quote_data = {
            "quote_id": quote_id,
            "quote_type": "GHS_TO_USDC",
            "source_amount_ghs": amount_ghs,
            "source_amount_pesewas": int(round(amount_ghs * 100)),
            "collection_fee_ghs": round(collection_fee_ghs, 2),
            "destination_asset": "USDC",
            "net_usdc_micro": net_usdc_micro,
            "net_usdc_display": round(gross_usdc, 2),
            "fx_rate_ghs_per_usdc": GHS_PER_USDC,
            "created_at": now,
            "expires_at": expires_at
        }
        self.quotes_cache[quote_id] = quote_data
        return quote_data

    def get_usdc_to_ghs_quote(
        self,
        target_ghs: float,
        payout_type: str = "MOMO"
    ) -> Dict:
        """
        Quotes how much USDC customer must pay to fulfill target GHS payout or bill.
        """
        if target_ghs <= 0:
            raise ValueError("Target GHS amount must be positive.")

        # Fixed nominal network/processing fee (GH₵1.50 for MoMo, GH₵0 for bills)
        service_fee_ghs = 1.50 if payout_type == "MOMO" else 0.50
        total_ghs = target_ghs + service_fee_ghs

        # Required USDC
        required_usdc = total_ghs / GHS_PER_USDC
        required_usdc_micro = int(round(required_usdc * 10**USDC_DECIMALS))

        quote_id = f"qte_ghs_out_{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        expires_at = now + self.validity_seconds

        quote_data = {
            "quote_id": quote_id,
            "quote_type": f"USDC_TO_{payout_type}",
            "target_ghs": target_ghs,
            "target_pesewas": int(round(target_ghs * 100)),
            "service_fee_ghs": service_fee_ghs,
            "total_ghs": total_ghs,
            "required_usdc_micro": required_usdc_micro,
            "required_usdc_display": round(required_usdc, 2),
            "fx_rate_ghs_per_usdc": GHS_PER_USDC,
            "created_at": now,
            "expires_at": expires_at
        }
        self.quotes_cache[quote_id] = quote_data
        return quote_data

    def validate_quote(self, quote_id: str) -> Dict:
        """Verifies quote exists and has not expired."""
        quote = self.quotes_cache.get(quote_id)
        if not quote:
            raise ValueError(f"Quote {quote_id} not found.")
        now = int(time.time())
        if now > quote['expires_at']:
            raise ValueError(f"Quote {quote_id} has expired. Please obtain a fresh quote.")
        return quote
