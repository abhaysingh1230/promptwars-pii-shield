# Security & Privacy Architecture — PII Shield

## 1. Browser-Only Execution & Zero Third-Party Requests
- **Client-Side Execution Only:** All PII scanning, Luhn/Verhoeff checksums, CSV parsing, redaction, and file downloads execute strictly in browser memory (`src/engine/` and `src/workers/sanitizer.worker.ts`).
- **Zero External Assets or API Calls:** System sans and monospace fonts are used locally—no external font CDNs, analytics, or remote APIs are loaded at runtime.
- **Browser-Enforced CSP (`connect-src 'none'`):** `vercel.json`, `nginx.conf.template`, and `firebase.json` enforce:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none';`
- **No Local Persistence:** Raw user inputs are never written to `localStorage`, `sessionStorage`, `IndexedDB`, or cookies.

## 2. XSS, CSV, and ReDoS Defenses
- **Pure JSX Rendering:** Highlighted diff segments render via React JSX elements; `dangerouslySetInnerHTML`, `innerHTML`, and `eval` are never used.
- **CSV Hardening (`src/engine/csv.ts`):**
  - `parseCsvStrict()` rejects unterminated quotes and invalid post-quote characters with explicit line errors.
  - `escapeCsvFormula()` neutralizes spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`) on sanitized CSV exports.
- **ReDoS & Resource Limits:**
  - `validateCustomRegex()` rejects nested-quantifier ReDoS patterns (`(a+)+`, `(a|aa)+`) and empty-matching expressions.
  - Enabled custom rules run inside a terminable Web Worker (`src/workers/sanitizer.worker.ts`) guarded by an **800 ms watchdog** that calls `worker.terminate()` on runaway execution.
  - File uploads are restricted to `.txt` / `.csv` and capped at 5 MB.

## 3. Encrypted Pseudonym Vault (`src/engine/cryptoVault.ts`)
- Optional vault exports use browser-native **Web Crypto API (`window.crypto.subtle`)**:
  - **KDF:** `PBKDF2` with `SHA-256` (**600,000 iterations**, random 128-bit salt per export)
  - **Passphrase Policy:** Minimum **12 characters** with at least two character classes
  - **Cipher:** `AES-GCM-256` (random 96-bit IV per export)
