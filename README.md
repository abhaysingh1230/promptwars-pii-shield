# PII Shield (`promptwars-pii-shield`)

> **PromptWars × NIAT Pune 2026 — Cybersecurity & Data Privacy Track**  
> **Live App:** https://promptwars-pii-shield.vercel.app  
> A **browser-only** data sanitization workstation that detects, validates, and redacts sensitive PII in pasted text, `.txt`, and `.csv` files locally inside browser memory—with **zero third-party runtime requests** and **strict CSP headers (`connect-src 'none'`)**.

---

## Key Capabilities & Supported Formats

- **Processed in This Browser:** Scanning, validation, redaction, and downloads run locally in browser memory using locally bundled fonts (`@fontsource/space-grotesk`) and system stacks—with zero third-party CDNs or remote APIs.
- **Dark & Light Workstation Themes:** Instant header switcher (`Dark` / `Light`) persisting only the UI theme preference locally while maintaining strict contrast and zero external requests.
- **6 Built-in PII Detectors + Standards Validators:**
  - **Credit Cards (13–19 digits):** Luhn mod-10 checksum validated to prevent false positives on random IDs
  - **Indian PAN:** Uppercase (`ABCDE1234F`) and mixed/lowercase ITD entity-coded formats
  - **Indian Aadhaar (12 digits):** Format-matched and explicitly tagged as `Verhoeff checksum verified` or `Format-matched · checksum unverified`
  - **Phone Numbers:** Locally bundled `libphonenumber-js/max` numbering-plan validation for Indian (`+91`, `0`-prefixed STD, 10-digit mobile) and international E.164 formats with extensions
  - **IPv4 & IPv6:** Strict `0–255` IPv4 octets and RFC 4291/5952 IPv6 (full, compressed, loopback `::1`, IPv4-mapped `::ffff:192.0.2.128`; unspecified `::` excluded; malformed/overlong values never partially redacted)
  - **Email Addresses** + **Unicode boundary safety**
- **Three Redaction Modes:** `Full mask` (`[REDACTED]`), `Partial mask` (`XXXX-XXXX-1234`), and `Pseudonymization` (`EMAIL_01`, `CARD_01`) consistent across multiline CSV tables.
- **Linear-Time Custom Rules (`re2js`):** Custom patterns run via Google's RE2 engine (`re2js`) inside a Web Worker with an 800 ms watchdog—preventing ReDoS freezes on patterns like `(a+)+$`.
- **CSV Hardening:** `parseCsvStrict()` flags unterminated/invalid quotes, `escapeCsvFormula()` neutralizes `=`, `+`, `-`, `@`, `\t`, `\r` even after leading spaces/control chars, and **Table View** labels multiline cells explicitly.
- **Encrypted Local Vault:** `PBKDF2-SHA256` (**600,000 iterations**) + `AES-GCM-256` with 12+ char mixed passphrase enforcement.

---

## Known Limitations

- Free-form unstructured PII (person names, street addresses) is not automatically detected unless targeted with a custom RE2 rule.
- Unprefixed 10-digit Indian numbers are restricted to mobile prefixes (`6–9`) so arbitrary numeric IDs are not falsely redacted; STD landlines require leading `0` or `+91`.
- Review the sanitized diff before sharing sensitive files; no pattern detector guarantees 100% recall on arbitrary prose.

See [`SECURITY.md`](./SECURITY.md) and the in-app **Security & limits** dialog for full details.

---

## Google Technologies Used (Privacy-Preserving)

- **Google Antigravity:** AI-assisted engineering workflow ([`PROMPT_LOG.md`](./PROMPT_LOG.md))
- **Google RE2 (`re2js`) & `libphonenumber` (`libphonenumber-js/max`):** Bundled locally for linear-time regexes and telecom numbering-plan validation with zero network requests
- **Google Cloud Run & Cloud Build:** Multi-stage `Dockerfile`, `nginx.conf.template` (port `8080`), and `cloudbuild.yaml`
- **Firebase Hosting Ready:** Configured in `firebase.json`
- **Chrome Built-in AI (Gemini Nano):** Optional on-device `LanguageModel` summary over aggregate counts only (`src/engine/chromeAi.ts`)

---

## Quick Start (Local)

```bash
npm install
npm test        # Run Vitest unit + UI/accessibility suite
npm run lint    # Run oxlint static checks
npm run build   # Type-check + build production bundle in dist/
npm run dev     # Start local dev server
```

## Credits

UI design refinements adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
