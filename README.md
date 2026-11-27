# PII Shield (`promptwars-pii-shield`)

> **PromptWars × NIAT Pune 2026 — Cybersecurity & Data Privacy Track**  
> **Live Demo:** https://promptwars-pii-shield.vercel.app  
> A **100% client-side, zero-server** browser data sanitization tool that detects, validates, classifies, and redacts sensitive PII in raw text, `.txt`, and `.csv` files without transmitting any data off your device.

---

## Key Capabilities

- **Zero-Server Execution:** All scanning, validation, redaction, and file exports happen strictly inside browser memory. Production headers enforce `connect-src 'none'`.
- **6 PII Detectors + Overlap Resolution:**
  - **Credit Card Numbers** (Visa, Mastercard, Amex, RuPay, Discover) with **strict Luhn mod-10 validation** to prevent false positives on random 16-digit IDs
  - **Indian PAN** (`ABCDE1234F`) with entity-type classification
  - **Indian Aadhaar** (12-digit spaced, hyphenated, and continuous formats) with Verhoeff confidence indicator
  - **Email Addresses**
  - **Phone Numbers** (`+91` / 10-digit Indian & international formats)
  - **IP Addresses** (validated IPv4 `0–255` octets & IPv6, ignoring software tags like `v1.2.3.4`)
- **Three Redaction Modes:**
  1. **Full Mask:** `[REDACTED]` (with optional typed tags `[REDACTED_EMAIL]`)
  2. **Partial Mask:** Preserves trailing/structural context (`XXXX-XXXX-1234`, `a***@domain.com`, `192.168.***.***`)
  3. **Consistent Pseudonymization:** Recurring entities map deterministically to the same token (`EMAIL_01`, `PHONE_01`, `CARD_01`) across entire documents and CSV tables
- **Audit, Risk Scoring & Export:**
  - Live **Exposure Risk Gauge** (`PCI-DSS`, `India DPDP / UIDAI / PAN`, `GDPR Contact`) & scan throughput (`MB/s`)
  - Live side-by-side color-coded diff view with **Synchronized Scroll**, **Click-to-Inspect** Luhn/Verhoeff proofs, and **CSV Spreadsheet Table Diff** mode
  - **Custom Secret & Regex Rule Builder** with 1-click presets (`Indian IFSC`, `API Keys`, `Employee ID`)
  - **Round-Trip Re-Hydration & AES-GCM-256 Local Vault** (`window.crypto.subtle`) for safely restoring pseudonymized LLM outputs locally
  - Per-category entity counts & **Luhn False-Positive Prevention log**
  - **1-click Sample Noisy Datasets** (4 presets including logs, CSV, clinical notes, KYC)
  - **1-click Download** for sanitized `.txt` / `.csv` files + safe `.json` audit summary

---

## Google Technologies Used (Privacy-Preserving)

- **Google Antigravity:** AI-assisted engineering and iterative prompt workflow (see [`PROMPT_LOG.md`](./PROMPT_LOG.md))
- **Google Cloud Run & Cloud Build:** Multi-stage `Dockerfile`, `nginx.conf.template` (port `8080`, CSP `connect-src 'none'`), and `cloudbuild.yaml` CI/CD deployment pipeline
- **Firebase Hosting Ready:** Configured in `firebase.json`
- **Chrome Built-in AI (Gemini Nano):** Optional on-device `LanguageModel` advisory in `src/engine/chromeAi.ts` that runs locally over aggregate redacted counts only (falls back seamlessly to deterministic local rules)
- **Google Fonts:** `Inter` & `JetBrains Mono`

See [`SECURITY.md`](./SECURITY.md) for the complete zero-server threat model, ReDoS bounds, and Web Crypto AES-GCM-256 specification.

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

## Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

---

## Credits

UI design system and anti-slop polish adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
