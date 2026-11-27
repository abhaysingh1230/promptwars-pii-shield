# Security & Privacy Architecture — PII Shield

## 1. Zero-Server Guarantee
- **Client-Side Execution Only:** All PII scanning, Luhn/Verhoeff checksums, CSV parsing, redaction, and file exports run 100% in browser memory (`src/engine/` and `src/workers/sanitizer.worker.ts`).
- **Browser-Enforced CSP (`connect-src 'none'`):** Production Nginx (`nginx.conf.template`) and Firebase (`firebase.json`) headers set `Content-Security-Policy` with `connect-src 'none'`, physically blocking `fetch()`, `XMLHttpRequest`, `WebSocket`, and `sendBeacon` at the browser level.
- **No Telemetry / No Persistence:** Raw user inputs are never written to `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or remote endpoints.

## 2. XSS & Injection Defenses
- **Pure JSX Rendering:** Highlighted diff segments (`DiffViewer.tsx`) render through React JSX nodes—`dangerouslySetInnerHTML`, `innerHTML`, and `eval` are never used.
- **ReDoS & Resource Limits:**
  - Built-in regexes use bounded quantifiers without nested backtracking.
  - User-supplied custom regexes are validated via `validateCustomRegex()` (240-char limit, syntax check, zero-length match rejection, and a 5,000-match loop guard).
  - File uploads are restricted to `.txt` / `.csv` extensions and capped at 5 MB.

## 3. Local Cryptographic Vault (`src/engine/cryptoVault.ts`)
- Optional pseudonym mapping exports use browser-native **Web Crypto API (`window.crypto.subtle`)**:
  - **KDF:** `PBKDF2` with `SHA-256` (100,000 iterations, random 128-bit salt per export)
  - **Cipher:** `AES-GCM-256` (random 96-bit IV per export)
