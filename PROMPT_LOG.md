# Prompt Engineering Log — PromptWars × NIAT Pune 2026

**Challenge Track:** Cybersecurity & Data Privacy  
**Project:** `promptwars-pii-shield`  
**Core Constraint:** Browser-only execution with zero external server transmission.

---

## Prompt Iteration 1 — Architecture & Zero-Server Privacy Boundary
**Prompt Goal:**  
> Design a browser-only PII sanitization workstation using Vite, React, TypeScript, and Tailwind CSS that processes pasted text and `.txt`/`.csv` files locally without transmitting data externally.

**Outcome:**  
- Built modular pure-TypeScript detection/redaction engine (`src/engine/`) with Web Worker execution (`src/workers/sanitizer.worker.ts`) and pure JSX diff rendering (zero `dangerouslySetInnerHTML`).

---

## Prompt Iteration 2 — Multi-PII Detection, Luhn & Edge-Case Hardening
**Prompt Goal:**  
> Support Emails, Indian & international phones (`+44`, `+1`, `+91`), IPv4/IPv6, uppercase & mixed-case Indian PAN, Aadhaar, and Luhn-validated Credit Cards with Unicode boundaries and explicit false-positive telemetry.

**Outcome:**  
- Implemented Luhn mod-10 diagnostics, Verhoeff checksum labeling (`Format-matched · checksum unverified` for synthetic test IDs), mixed-case PAN entity-code validation, compressed IPv6 support, and Unicode boundary lookbehinds.

---

## Prompt Iteration 3 — CSV Strict Parsing, Formula Escaping & 3 Redaction Modes
**Prompt Goal:**  
> Support Full mask, Partial mask, and Pseudonymization across plain text and CSV tables while detecting malformed CSV quotes and preventing spreadsheet formula injection.

**Outcome:**  
- Added `parseCsvStrict()` for explicit quote error reporting, `escapeCsvFormula()` on sanitized CSV exports, and `PseudonymRegistry` shared across multiline CSV cells.

---

## Prompt Iteration 4 — AppSec Audit Hardening & Workstation UX
**Prompt Goal:**  
> Remove external font requests, enforce strict CSP headers on Vercel (`connect-src 'none'`), guard custom regexes in a terminable Web Worker with ReDoS rejection, harden PBKDF2 to 600,000 iterations, start with a clean empty workspace, and enforce full WCAG keyboard/modal accessibility.

**Outcome:**  
- Shipped `vercel.json` security headers, system-font zero-external-request runtime, 800 ms terminable worker watchdog, 600k PBKDF2 + 12-char passphrase vault, keyboard tablist navigation, modal focus trap with focus return, and expanded Vitest suite.
