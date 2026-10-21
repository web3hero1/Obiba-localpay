# Obiba LocalPay — Core Financial Platform

> **"One USDC balance. Global money. Local rails."**  
> *Built for the NEAR Hackathon 2026.*

Obiba connects global digital dollars (USDC) to local African financial services. By integrating **NEAR Intents (1Click API)**, Obiba abstracts the complexity of bridging, cross-chain swaps, and gas tokens, allowing users to deposit any supported cryptocurrency (BTC, ETH, SOL, USDT, USDC, NEAR) directly into a single USDC-denominated balance and instantly spend it on everyday Ghanaian payments (MTN Mobile Money, ECG electricity tokens, airtime, and data).

---

## 🚀 Key Features

1. **One USDC Balance**:
   - Single digital-dollar account backing all customer activities.
   - Dynamic indicative local currency equivalent (`≈ GH₵858.27` at `1 USDC = 15.25 GHS`).
2. **NEAR Intents 1Click Integration**:
   - Chain abstraction powered by Defuse Protocol's 1Click API.
   - Generates unique one-time deposit addresses on source chains.
   - Competitive solver network matches, swaps, and settles USDC directly into Obiba's custody vault.
3. **Deterministic Double-Entry Financial Ledger**:
   - Strict append-only journal entries.
   - Zero floating-point arithmetic: USDC stored in **integer micro-units** (6 decimals) and GHS in **pesewas** (2 decimals).
   - Invariant: $\sum\text{Debits} = \sum\text{Credits}$ for every transaction.
4. **Ghana Local Rails**:
   - **Mobile Money**: Instant cash-in & payouts for MTN MoMo, Telecel Cash, and AT Money.
   - **ECG Electricity Bills**: Meter number validation with instant 20-digit prepaid recharge token generation (`xxxx-xxxx-xxxx-xxxx-xxxx`).
   - **Everyday Services**: Airtime and data bundle top-ups.
5. **Hackathon Ledger Inspector**:
   - Built-in slide-over audit drawer for hackathon judges to verify the double-entry journal lines, NEAR solver RFQs, and treasury positions in real time.

---

## 🛠 Project Structure

```text
obiba-localpay/
├── core/
│   ├── ledger.py               # Double-entry ledger (integer minor units, ACID)
│   ├── quotes.py               # Central quote service (FX, spreads, expiry)
│   └── payment_orchestrator.py # Two-phase commit state machine & holds
├── adapters/
│   ├── near_intents.py         # NEAR Intents 1Click provider adapter
│   └── ghana_rails.py          # MTN/Telecel MoMo, ECG electricity, and billers
├── static/
│   └── index.html              # Pixel-perfect Obiba mobile app (#0A84FF) & Inspector
├── tests/
│   ├── test_ledger.py          # Unit tests for double-entry invariants & holds
│   └── test_payment_orchestrator.py # Integration tests for deposit, payout & bills
├── server.py                   # Zero-dependency HTTP server & REST API
└── README.md
```

---

## 🚦 Quick Start (Local Run)

No heavy external dependencies or package managers required. Runs immediately using Python 3:

```bash
# 1. Start the Obiba server
python3 server.py 8080

# 2. Open the application in your browser
open http://localhost:8080
```

---

## 🧪 Automated Test Suite

Run the full automated test suite verifying ledger invariants, idempotency, overdraft protection, and NEAR Intents conversions:

```bash
python3 -m unittest discover tests
```

Expected output:
```text
........
----------------------------------------------------------------------
Ran 8 tests in 0.090s

OK
```

---

## 🎯 Demo Walkthrough for Judges

1. **View Available Balance**: Open `http://localhost:8080` to see your initial `$56.28 USDC` (`≈ GH₵858.27`).
2. **Deposit Crypto via NEAR Intents**:
   - Click **Add Money** → **Deposit Crypto**.
   - Select **SOL** (or ETH/BTC/USDT) and input an amount.
   - Review the solver quote and click **Continue to Deposit**.
   - Observe the generated one-time deposit address (`So1...`).
   - Click **Simulate User Transfer & Solver Settlement** to watch the solver advance through `Deposit Detected` $\to$ `Converting` $\to$ `Settlement Verified` $\to$ `Credited`.
3. **Pay an ECG Electricity Bill**:
   - On the Home screen, tap **Bills**.
   - Verify the meter number (`482019-2041`) and select `GH₵100`.
   - Click **Pay with USDC & Generate Token**.
   - Inspect the returned **20-digit recharge token** (`xxxx-xxxx-xxxx-xxxx-xxxx`).
4. **Send Money to MTN MoMo**:
   - Tap **Send Money** → input recipient phone number `0559876543` and amount `GH₵100`.
   - Authorize to execute the payout and debit available USDC.
5. **Inspect the Double-Entry Ledger**:
   - Click the terminal icon in the header to open the **Hackathon Ledger Inspector**.
   - Review each balanced debit and credit journal entry created by your actions!

---

## 🔐 Authentication & Profile Architecture

Obiba implements a complete, bank-grade **Email + Password** authentication system adhering strictly to consumer fintech standards (no crypto wallet connection required to sign up):

### 1. Account Credentials & Validation
- **Full Legal Name**: Enforces min 2 characters, valid name characters.
- **Ghana Phone Number**: Default `+233`, automatically validated and normalized into E.164 format (e.g. `024 123 4567` $\to$ `+233241234567`). Stored as unverified contact info.
- **Email Address**: Strictly validated, lowercased, and verified before access to financial services is granted.
- **Strong Password Policy**: Enforces $\ge 12$ characters, uppercase, lowercase, number, and special character with interactive visual strength indicator.

### 2. Routes & User Journey
- `/auth`: Clean, branded Welcome Screen ("Your money, made simple").
- `/auth/signup`: Validated account creation screen with password strength checklist.
- `/auth/check-email`: Email confirmation screen with masked address (`k***h@example.com`) and rate-limited resend countdown.
- `/auth/confirm`: Server-Side Route handler processing Supabase PKCE and `token_hash` verification for signups and password recoveries.
- `/auth/verified`: Email verification confirmation screen welcoming the user.
- `/auth/login`: Sign-in screen with unverified-email diversion and generic error protection against email enumeration.
- `/auth/forgot-password`: Password recovery request screen.
- `/auth/reset-password`: Set new password screen with session verification.
- `/dashboard`: Protected dashboard with user profile metadata, double-entry USDC wallet balance, and everyday payments.
- `/`: Redirects directly to `/auth` or `/dashboard` based on authentication session.

### 3. Supabase PostgreSQL Schema & Security
- `public.profiles` table linked via UUID foreign key to `auth.users(id)` with `ON DELETE CASCADE`.
- Database trigger `handle_new_user()` atomically inserts profile metadata on `auth.users` creation.
- Strict **Row Level Security (RLS)**:
  - Users can read only their own profile: `auth.uid() = id`.
  - Users can update only their own contact info (`full_name`, `phone_number`), while `verification_status` remains immutable from client calls.
- Next.js SSR middleware (`middleware.ts`) protects authenticated routes, validates sessions, and redirects unconfirmed users.

### 4. Running the Authentication Test Suite
Obiba includes 23 automated tests covering Ghana phone normalization, password strength scoring, and Zod input schemas:

```bash
npm run test:auth
```

---

## 🔒 Security & Financial Standards

- **No Float Arithmetic**: All ledger values and fee calculations use integer minor units.
- **Two-Phase Funds Reservation**: Outbound payments place funds on hold in a reserved liability account before executing settlement, preventing double-spend.
- **Strict Idempotency**: Payment and deposit requests enforce unique idempotency keys to eliminate duplicate debits or credits.
- **Isolated Sandbox**: P0 operates in zero-risk mock/sandbox mode without moving real customer funds.
