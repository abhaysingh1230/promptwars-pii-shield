# Security & Privacy Architecture — PII Shield

## 1. Local Browser Execution & Network Behavior
- **Local Processing:** All PII scanning, Luhn/Verhoeff checks, phone validation (`libphonenumber-js/max` bundled locally), CSV parsing, redaction, and downloads run inside browser memory (`src/engine/` and `src/workers/sanitizer.worker.ts`).
- **Zero Third-Party Runtime Assets:** Uses locally bundled `@fontsource/space-grotesk` (`font-src 'self'`) and system UI/monospace stacks with no external font CDNs, analytics, or remote API calls.
- **Content Security Policy:** `vercel.json`, `nginx.conf.template`, and `firebase.json` enforce:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none';`
- **No PII Persistence:** Raw user inputs and detected PII are never written to `localStorage`, `sessionStorage`, `IndexedDB`, or cookies (`localStorage` is used solely for the `pii-shield-theme` `'dark'`/`'light'` preference).

## 2. Format Matches vs. Checksum Validation & Known Limitations
- **Credit Cards (13–19 digits):** Verified with Luhn mod-10 (`luhnDiagnostics()`) so non-Luhn numeric IDs are preserved.
- **Indian Aadhaar (12 digits):** Matched by UID format and explicitly labeled either `Verhoeff checksum verified` or `Format-matched · checksum unverified` so synthetic test IDs are still masked.
- **Phone Numbers:** Validated locally against bundled `libphonenumber-js/max` numbering plans; unprefixed 10-digit Indian numbers require mobile prefixes `6–9` (STD landlines require `0` or `+91`).
- **IPv6:** Validates full, compressed, loopback (`::1`), and IPv4-mapped (`::ffff:192.0.2.128`) forms per RFC 4291 / 5952. Excludes the unspecified address (`::` / `0:0:0:0:0:0:0:0`) and prevents partial redaction of malformed/overlong strings.
- **Limitation:** Unstructured prose PII (free-form person names, physical addresses) is not automatically detected unless targeted with a custom RE2 rule.

## 3. Custom Rules (RE2 Linear-Time), CSV Hardening, and Vault Encryption
- **Linear-Time Custom Rules (`re2js`):** Compiled and executed with Google's RE2 DFA/NFA engine (`re2js`) inside a Web Worker with an 800 ms watchdog—preventing catastrophic backtracking freezes.
- **CSV Protection (`src/engine/csv.ts`):**
  - `parseCsvStrict()` reports unterminated quotes and invalid post-quote characters with line errors.
  - `escapeCsvFormula()` escapes cells starting with `\t`, `\r`, or leading whitespace/control characters followed by `=`, `+`, `-`, or `@`.
- **Encrypted Vault (`src/engine/cryptoVault.ts`):** Uses Web Crypto `PBKDF2-SHA256` (**600,000 iterations**) + `AES-GCM-256` with a **12+ character mixed passphrase** policy.
