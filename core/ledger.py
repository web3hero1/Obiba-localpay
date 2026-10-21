"""
Obiba Financial Core — Deterministic Double-Entry Financial Ledger (PRD §22)

Rules:
1. Integer minor units only (no floats):
   - USDC: 6 decimals (1 USDC = 1,000,000 micro-units)
   - GHS: 2 decimals (1 GHS = 100 pesewas)
2. Every journal entry must balance: Sum(Debits) == Sum(Credits).
3. Append-only ledger; balances are derived from immutable journal entries.
4. Separate available balance and reserved/held balance.
"""

import sqlite3
import uuid
import time
from typing import Dict, List, Optional, Tuple

# Account chart codes
ASSET_USDC_SETTLEMENT = "1000:ASSET:SETTLEMENT:USDC"
ASSET_GHS_TREASURY = "1010:ASSET:TREASURY:GHS"
REVENUE_CONVERSION_FEES = "4000:REVENUE:CONVERSION_FEES"
REVENUE_SERVICE_FEES = "4010:REVENUE:SERVICE_FEES"

def user_available_account(user_id: str) -> str:
    return f"2000:LIABILITY:USER_AVAILABLE:{user_id}"

def user_reserved_account(user_id: str) -> str:
    return f"2010:LIABILITY:USER_RESERVED:{user_id}"

class DoubleEntryLedger:
    def __init__(self, db_path: str = "obiba.db"):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                account_id TEXT PRIMARY KEY,
                currency TEXT NOT NULL,
                account_type TEXT NOT NULL,
                description TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS journals (
                journal_id TEXT PRIMARY KEY,
                idempotency_key TEXT UNIQUE,
                reference TEXT NOT NULL,
                narration TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS entries (
                entry_id TEXT PRIMARY KEY,
                journal_id TEXT NOT NULL,
                account_id TEXT NOT NULL,
                direction TEXT NOT NULL CHECK(direction IN ('DEBIT', 'CREDIT')),
                amount INTEGER NOT NULL CHECK(amount > 0),
                currency TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (journal_id) REFERENCES journals(journal_id),
                FOREIGN KEY (account_id) REFERENCES accounts(account_id)
            );

            CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id);
            CREATE INDEX IF NOT EXISTS idx_entries_journal ON entries(journal_id);
            CREATE INDEX IF NOT EXISTS idx_journals_ref ON journals(reference);
            """)

            # Ensure system accounts exist
            system_accounts = [
                (ASSET_USDC_SETTLEMENT, "USDC", "ASSET", "NEAR Intents / Custody Settlement Pool"),
                (ASSET_GHS_TREASURY, "GHS", "ASSET", "Ghana Local MoMo & Biller Payout Treasury"),
                (REVENUE_CONVERSION_FEES, "USDC", "REVENUE", "Obiba FX & Conversion Revenue"),
                (REVENUE_SERVICE_FEES, "USDC", "REVENUE", "Obiba Payout & Bill Service Fees")
            ]
            now = int(time.time())
            for acc_id, curr, acc_type, desc in system_accounts:
                conn.execute("""
                INSERT OR IGNORE INTO accounts (account_id, currency, account_type, description, created_at)
                VALUES (?, ?, ?, ?, ?)
                """, (acc_id, curr, acc_type, desc, now))

    def ensure_account(self, account_id: str, currency: str = "USDC"):
        now = int(time.time())
        acc_type = "LIABILITY" if "LIABILITY" in account_id else ("REVENUE" if "REVENUE" in account_id else "ASSET")
        with self._get_connection() as conn:
            conn.execute("""
            INSERT OR IGNORE INTO accounts (account_id, currency, account_type, description, created_at)
            VALUES (?, ?, ?, ?, ?)
            """, (account_id, currency, acc_type, f"Auto-registered {account_id}", now))

    def ensure_user_accounts(self, user_id: str):
        now = int(time.time())
        avail = user_available_account(user_id)
        res = user_reserved_account(user_id)
        with self._get_connection() as conn:
            conn.execute("""
            INSERT OR IGNORE INTO accounts (account_id, currency, account_type, description, created_at)
            VALUES (?, 'USDC', 'LIABILITY', 'Customer Available USDC Balance', ?)
            """, (avail, now))
            conn.execute("""
            INSERT OR IGNORE INTO accounts (account_id, currency, account_type, description, created_at)
            VALUES (?, 'USDC', 'LIABILITY', 'Customer Reserved Funds for Pending Payouts', ?)
            """, (res, now))

    def record_journal(
        self,
        reference: str,
        narration: str,
        entries: List[Dict],
        idempotency_key: Optional[str] = None
    ) -> str:
        """
        Atomically records a balanced journal entry.
        Each entry dict: {'account_id': str, 'direction': 'DEBIT'|'CREDIT', 'amount': int, 'currency': str}
        """
        if not entries:
            raise ValueError("Journal must contain at least two entries.")

        # Invariant 1: Sum of debits per currency must equal sum of credits per currency
        currency_totals: Dict[str, Dict[str, int]] = {}
        for entry in entries:
            curr = entry['currency']
            direction = entry['direction']
            amt = entry['amount']
            if amt <= 0:
                raise ValueError("Entry amount must be positive integer minor units.")
            if curr not in currency_totals:
                currency_totals[curr] = {'DEBIT': 0, 'CREDIT': 0}
            currency_totals[curr][direction] += amt

        for curr, totals in currency_totals.items():
            if totals['DEBIT'] != totals['CREDIT']:
                raise ValueError(
                    f"Unbalanced journal for {curr}: DEBIT {totals['DEBIT']} != CREDIT {totals['CREDIT']}"
                )

        journal_id = f"jnl_{uuid.uuid4().hex[:12]}"
        now = int(time.time())

        with self._get_connection() as conn:
            # Ensure all accounts exist prior to transaction
            for entry in entries:
                acc_type = "LIABILITY" if "LIABILITY" in entry['account_id'] else ("REVENUE" if "REVENUE" in entry['account_id'] else "ASSET")
                conn.execute("""
                INSERT OR IGNORE INTO accounts (account_id, currency, account_type, description, created_at)
                VALUES (?, ?, ?, ?, ?)
                """, (entry['account_id'], entry['currency'], acc_type, f"Account {entry['account_id']}", now))

            # Check idempotency
            if idempotency_key:
                cur = conn.execute(
                    "SELECT journal_id FROM journals WHERE idempotency_key = ?",
                    (idempotency_key,)
                )
                existing = cur.fetchone()
                if existing:
                    return existing['journal_id']

            conn.execute("""
            INSERT INTO journals (journal_id, idempotency_key, reference, narration, created_at)
            VALUES (?, ?, ?, ?, ?)
            """, (journal_id, idempotency_key, reference, narration, now))

            for entry in entries:
                entry_id = f"ent_{uuid.uuid4().hex[:12]}"
                conn.execute("""
                INSERT INTO entries (entry_id, journal_id, account_id, direction, amount, currency, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    entry_id,
                    journal_id,
                    entry['account_id'],
                    entry['direction'],
                    entry['amount'],
                    entry['currency'],
                    now
                ))

        return journal_id

    def get_account_balance(self, account_id: str) -> int:
        """
        Calculates balance based on account type.
        For ASSET: Debits increase (+), Credits decrease (-).
        For LIABILITY/REVENUE: Credits increase (+), Debits decrease (-).
        Returns integer minor units.
        """
        with self._get_connection() as conn:
            acc_cur = conn.execute(
                "SELECT account_type FROM accounts WHERE account_id = ?",
                (account_id,)
            )
            acc = acc_cur.fetchone()
            if not acc:
                return 0
            acc_type = acc['account_type']

            cur = conn.execute("""
            SELECT direction, SUM(amount) as total
            FROM entries
            WHERE account_id = ?
            GROUP BY direction
            """, (account_id,))
            totals = {'DEBIT': 0, 'CREDIT': 0}
            for row in cur.fetchall():
                totals[row['direction']] = row['total'] or 0

            if acc_type in ('LIABILITY', 'REVENUE'):
                return totals['CREDIT'] - totals['DEBIT']
            else: # ASSET or EXPENSE
                return totals['DEBIT'] - totals['CREDIT']

    def get_user_balances(self, user_id: str) -> Dict[str, int]:
        """
        Returns {
          'available_usdc': int (micro-USDC),
          'reserved_usdc': int (micro-USDC),
          'total_posted_usdc': int (micro-USDC)
        }
        """
        self.ensure_user_accounts(user_id)
        avail = self.get_account_balance(user_available_account(user_id))
        res = self.get_account_balance(user_reserved_account(user_id))
        return {
            'available_usdc': avail,
            'reserved_usdc': res,
            'total_posted_usdc': avail + res
        }

    def get_recent_journals(self, limit: int = 50) -> List[Dict]:
        """Returns list of recent journals with their entry lines for audit/inspector."""
        with self._get_connection() as conn:
            j_cur = conn.execute("""
            SELECT journal_id, reference, narration, created_at
            FROM journals
            ORDER BY created_at DESC, rowid DESC
            LIMIT ?
            """, (limit,))
            journals = []
            for j in j_cur.fetchall():
                e_cur = conn.execute("""
                SELECT entry_id, account_id, direction, amount, currency
                FROM entries
                WHERE journal_id = ?
                """, (j['journal_id'],))
                entries = [dict(e) for e in e_cur.fetchall()]
                journals.append({
                    'journal_id': j['journal_id'],
                    'reference': j['reference'],
                    'narration': j['narration'],
                    'created_at': j['created_at'],
                    'entries': entries
                })
            return journals
