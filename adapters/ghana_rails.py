"""
Obiba Financial Core — Ghana Local Rails Adapter (PRD §10, §14-§17)

Provides integration adapters for:
- Mobile Money Collection & Payouts (MTN MoMo, Telecel Cash, AT Money)
- Bank Transfers & Payouts (GCB, Ecobank, Stanbic, Absa, Fidelity)
- Utility Bill Payments (ECG Electricity Prepaid Tokens, Ghana Water)
- Airtime and Mobile Data Bundles
"""

import random
import time
import uuid
from typing import Dict, List, Optional

GHANA_MOMO_PROVIDERS = [
    {"id": "MTN", "name": "MTN Mobile Money", "prefix": ["024", "054", "055", "059", "025"]},
    {"id": "TELECEL", "name": "Telecel Cash", "prefix": ["020", "050"]},
    {"id": "AT", "name": "AT Money", "prefix": ["027", "057", "026"]}
]

GHANA_BANKS = [
    {"code": "GCB", "name": "GCB Bank Ltd"},
    {"code": "ECOBANK", "name": "Ecobank Ghana"},
    {"code": "STANBIC", "name": "Stanbic Bank Ghana"},
    {"code": "ABSA", "name": "Absa Bank Ghana"},
    {"code": "FIDELITY", "name": "Fidelity Bank Ghana"}
]

DATA_BUNDLES = [
    {"id": "mtn_1gb", "provider": "MTN", "name": "1.2 GB Super Bundle", "ghs_price": 10.00, "validity": "24 Hours"},
    {"id": "mtn_3gb", "provider": "MTN", "name": "3.5 GB Jumbo", "ghs_price": 25.00, "validity": "7 Days"},
    {"id": "mtn_10gb", "provider": "MTN", "name": "10 GB Flexi", "ghs_price": 60.00, "validity": "30 Days"},
    {"id": "telecel_2gb", "provider": "TELECEL", "name": "2.5 GB Telecel Daily", "ghs_price": 12.00, "validity": "48 Hours"},
    {"id": "telecel_8gb", "provider": "TELECEL", "name": "8 GB Telecel Monthly", "ghs_price": 50.00, "validity": "30 Days"}
]

class GhanaRailsAdapter:
    def __init__(self):
        pass

    def validate_phone(self, phone: str) -> bool:
        cleaned = phone.replace(" ", "").replace("-", "").replace("+233", "0")
        return len(cleaned) == 10 and cleaned.startswith("0")

    def simulate_momo_collection(self, provider: str, phone: str, amount_ghs: float) -> Dict:
        """
        Simulates telecom collection prompt (USSD push prompt sent to customer phone).
        """
        if not self.validate_phone(phone):
            raise ValueError(f"Invalid Ghana phone number '{phone}'.")

        ref = f"momo_in_{uuid.uuid4().hex[:10]}"
        return {
            "collection_id": ref,
            "provider": provider,
            "phone": phone,
            "amount_ghs": amount_ghs,
            "status": "SETTLED", # In demo/sandbox, telecom collection completes immediately
            "provider_reference": f"MOMO-USSD-{random.randint(100000, 999999)}",
            "message": f"Payment prompt approved on {phone} ({provider}). Funds verified in settlement account."
        }

    def simulate_momo_payout(self, provider: str, recipient_phone: str, amount_ghs: float) -> Dict:
        """
        Executes local payout to recipient's mobile money wallet.
        """
        if not self.validate_phone(recipient_phone):
            raise ValueError(f"Invalid Ghana recipient phone number '{recipient_phone}'.")

        ref = f"momo_out_{uuid.uuid4().hex[:10]}"
        return {
            "payout_id": ref,
            "provider": provider,
            "recipient_phone": recipient_phone,
            "amount_ghs": amount_ghs,
            "status": "COMPLETED",
            "external_reference": f"PAY-{random.randint(2000000, 9999999)}",
            "network_auth_code": f"TX{random.randint(100000, 999999)}",
            "timestamp": int(time.time()),
            "message": f"GH₵{amount_ghs:.2f} successfully delivered to {recipient_phone} ({provider})."
        }

    def validate_meter_number(self, meter_number: str) -> Dict:
        """Validates ECG prepaid meter and returns mock customer info."""
        cleaned = meter_number.replace("-", "").strip()
        if len(cleaned) < 6:
            raise ValueError("Meter number must be at least 6 digits.")

        # Deterministic mock name based on meter suffix
        customer_names = [
            "Kwame Mensah - East Legon",
            "Abena Osei - Osu, Accra",
            "Kofi Boateng - Kumasi Central",
            "Akua Darko - Tema Community 1"
        ]
        assigned_name = customer_names[int(cleaned[-1]) % len(customer_names)]

        return {
            "valid": True,
            "meter_number": meter_number,
            "customer_name": assigned_name,
            "meter_type": "PREPAID_SMART",
            "tariff": "Residential Low-Voltage (RLV)"
        }

    def fulfill_ecg_bill(self, meter_number: str, amount_ghs: float) -> Dict:
        """
        Fulfills ECG electricity purchase and generates 20-digit prepaid recharge token.
        Format: xxxx-xxxx-xxxx-xxxx-xxxx
        """
        validation = self.validate_meter_number(meter_number)

        # Generate 20-digit token
        digits = "".join([str(random.randint(0, 9)) for _ in range(20)])
        token = f"{digits[0:4]}-{digits[4:8]}-{digits[8:12]}-{digits[12:16]}-{digits[16:20]}"

        # Calculated kWh units (assuming roughly GH₵1.55 per kWh)
        kwh_units = round(amount_ghs / 1.55, 1)

        return {
            "biller": "ECG Electricity",
            "meter_number": meter_number,
            "customer_name": validation["customer_name"],
            "amount_ghs": amount_ghs,
            "kwh_units": kwh_units,
            "token": token,
            "receipt_number": f"ECG-{random.randint(10000000, 99999999)}",
            "timestamp": int(time.time()),
            "instructions": "Enter the 20-digit token into your ECG CIU keypad and press Enter."
        }

    def fulfill_airtime(self, provider: str, phone: str, amount_ghs: float) -> Dict:
        """Instant airtime recharge."""
        if not self.validate_phone(phone):
            raise ValueError("Invalid phone number for airtime.")

        return {
            "biller": f"{provider} Airtime",
            "phone": phone,
            "amount_ghs": amount_ghs,
            "status": "COMPLETED",
            "receipt_number": f"AIR-{random.randint(1000000, 9999999)}",
            "timestamp": int(time.time()),
            "message": f"GH₵{amount_ghs:.2f} airtime successfully topped up for {phone}."
        }

    def fulfill_data_bundle(self, bundle_id: str, phone: str) -> Dict:
        """Instant data bundle top-up."""
        bundle = next((b for b in DATA_BUNDLES if b["id"] == bundle_id), None)
        if not bundle:
            raise ValueError(f"Bundle '{bundle_id}' not found.")
        if not self.validate_phone(phone):
            raise ValueError("Invalid phone number for data bundle.")

        return {
            "biller": f"{bundle['provider']} Data Bundle",
            "bundle_name": bundle["name"],
            "phone": phone,
            "amount_ghs": bundle["ghs_price"],
            "status": "COMPLETED",
            "receipt_number": f"DATA-{random.randint(1000000, 9999999)}",
            "timestamp": int(time.time()),
            "message": f"{bundle['name']} activated for {phone}. Valid for {bundle['validity']}."
        }
