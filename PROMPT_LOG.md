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
> Support Emails, Indian & international phones, IPv4/IPv6, uppercase & mixed-case Indian PAN, Aadhaar, and Luhn-validated Credit Cards with Unicode boundaries and explicit false-positive telemetry.

**Outcome:**  
- Implemented Luhn mod-10 diagnostics across 13–19 digits, Verhoeff status distinction (`Format-matched · checksum unverified`), mixed-case PAN entity-code validation, and Unicode boundary lookbehinds.

---

## Prompt Iteration 3 — CSV Strict Parsing, Formula Escaping & 3 Redaction Modes
**Prompt Goal:**  
> Support Full mask, Partial mask, and Pseudonymization across plain text and CSV tables while detecting malformed CSV quotes and preventing spreadsheet formula injection.

**Outcome:**  
- Added `parseCsvStrict()` for explicit quote error reporting, `escapeCsvFormula()` covering leading whitespace/control characters before `=`, `+`, `-`, `@`, and `PseudonymRegistry` shared across multiline CSV cells.

---

## Prompt Iteration 4 — Linear-Time RE2 Custom Rules, Standards IPv6, Numbering-Plan Phones & Verification
**Prompt Goal:**  
> Replace heuristic ReDoS prevention with Google's linear-time RE2 engine (`re2js`), validate phones with locally bundled `libphonenumber-js/max`, upgrade IPv6 to full RFC 4291/5952 validation, add a Security & Limitations view, and verify CSP headers + zero external network traffic live.

**Outcome:**  
- Integrated `re2js` (linear-time DFA/NFA matching verified on `(a+)+$` & `(a|aa)+$` against 50k chars), `libphonenumber-js/max` local metadata, standards-based IPv6 (including IPv4-mapped `::ffff:192.0.2.128`, rejecting `::` and malformed/overlong spans without partial redaction), WCAG contrast & keyboard tabs, modal focus trap, and verified `vercel.json` CSP headers.

---

## Prompt Iteration 5 — Privacy Workstation Redesign & Dark/Light Theme Switcher
**Prompt Goal:**  
> Refine the UI into a calm, responsive 2026 privacy workstation with connected Original → Sanitized panels, locally bundled typography, live processing readout, and a switchable Dark/Light theme.

**Outcome:**  
- Bundled `@fontsource/space-grotesk` locally (`font-src 'self'`), added connected `Original` → `Sanitized` workspace panels with entity inspection and reduced-motion scan sweep, and implemented CSS-variable-backed `Dark` and `Light` themes verified across desktop (`1366×768`) and mobile (`375×812`) with zero external network calls.
