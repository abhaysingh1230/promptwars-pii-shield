# PII Shield (`promptwars-pii-shield`)

> **PromptWars × NIAT Pune 2026 — Cybersecurity & Data Privacy Track**  
> **Live App:** https://promptwars-pii-shield.vercel.app  
> A **browser-only** data sanitization workstation that detects, validates, classifies, and redacts sensitive PII in pasted text, `.txt`, and `.csv` files—with **zero third-party network requests** and **strict CSP headers (`connect-src 'none'`)**.

---

## Key Capabilities

- **Processed in This Browser:** All scanning, validation, redaction, and downloads run locally in browser memory. Uses system fonts with zero third-party CDNs or analytics.
- **6 Built-in PII Detectors + Unicode Boundary Safety:**
  - **Credit Card Numbers** (Visa, Mastercard, Amex, RuPay, Discover) with **strict Luhn mod-10 validation** to prevent false positives on random 16-digit IDs
  - **Indian PAN** (both uppercase `ABCDE1234F` and mixed/lowercase ITD entity-coded formats)
  - **Indian Aadhaar** (12-digit spaced, hyphenated, and continuous formats with explicit Verhoeff checksum status)
  - **Email Addresses**
  - **Phone Numbers** (Indian `+91` / 10-digit + international `+44`, `+1`, `+61` E.164 formats)
  - **IP Addresses** (validated IPv4 `0–255` octets & compressed/full IPv6)
- **Three Redaction Modes:**
  1. **Full Mask:** `[REDACTED]` (with optional `[REDACTED_TYPE]` tags)
  2. **Partial Mask:** Preserves trailing/structural context (`XXXX-XXXX-1234`, `a***@domain.com`)
  3. **Pseudonymization:** Deterministic tokens (`EMAIL_01`, `PHONE_01`, `CARD_01`) shared across multiline CSV tables and documents
- **CSV & Security Hardening:**
  - **Malformed CSV Detection:** `parseCsvStrict()` reports unterminated quotes and invalid quoting instead of silently misreading rows
  - **Spreadsheet Formula Injection Defense:** Escapes `=`, `+`, `-`, `@`, `\t`, `\r` prefixes in CSV exports
  - **Table View + Multiline Indicator:** Inspect sanitized CSV cells with row/column headers and multiline cell badges
  - **Terminable Web Worker Custom Rules:** Static ReDoS rejection + 800 ms watchdog termination
  - **Encrypted Local Vault:** `PBKDF2-SHA256` (**600,000 iterations**) + `AES-GCM-256` with 12+ character passphrase enforcement

---

## Google Technologies Used (Privacy-Preserving)

- **Google Antigravity:** AI-assisted engineering and prompt workflow (see [`PROMPT_LOG.md`](./PROMPT_LOG.md))
- **Google Cloud Run & Cloud Build:** Multi-stage `Dockerfile`, `nginx.conf.template` (port `8080`), and `cloudbuild.yaml`
- **Firebase Hosting Ready:** Configured in `firebase.json`
- **Chrome Built-in AI (Gemini Nano):** Optional on-device `LanguageModel` summary over aggregate counts only (`src/engine/chromeAi.ts`)

See [`SECURITY.md`](./SECURITY.md) for the complete zero-server threat model, CSP policy, and cryptography specification.

---

## Quick Start (Local)

```bash
npm install
npm test        # Run Vitest unit + UI test suite
npm run lint    # Run oxlint static checks
npm run build   # Type-check + build production bundle in dist/
npm run dev     # Start local dev server
```

## Deploy to Google Cloud Run

```bash
gcloud run deploy pii-shield \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated
```

---

## Credits

UI craftsmanship and anti-slop refinements adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
