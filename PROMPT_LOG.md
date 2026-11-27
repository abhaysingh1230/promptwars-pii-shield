# Prompt Engineering Log — PromptWars × NIAT Pune 2026

**Challenge Track:** Cybersecurity & Data Privacy  
**Project:** `promptwars-pii-shield`  
**Core Constraint:** 100% client-side browser execution with zero external server transmission.

---

## Prompt Iteration 1 — Architecture & Zero-Server Privacy Boundary
**Prompt Goal:**  
> Design a browser-based data sanitization web app using Vite, React, TypeScript, and Tailwind CSS that processes raw pasted text and uploaded `.txt`/`.csv` files entirely in browser memory without sending any user payload to external APIs or backends.

**Key Decisions & Guardrails:**
- Rejected external LLM API calls on raw input to guarantee compliance with the zero-server privacy requirement.
- Designed a modular pure-TypeScript engine (`src/engine/`) with deterministic O(n) scanning and safe React JSX rendering (zero `dangerouslySetInnerHTML`).
- Enforced `connect-src 'none'` in production Nginx/Firebase CSP headers so browsers physically block any outbound `fetch`/`XHR` calls.

---

## Prompt Iteration 2 — Multi-PII Detection & Luhn False-Positive Filtering
**Prompt Goal:**  
> Implement accurate client-side detectors for Emails, Phone Numbers (Indian +91 & international), IPv4/IPv6 addresses, Indian PAN (`ABCDE1234F`), Indian Aadhaar (12-digit UID format), and Credit Card numbers with Luhn mod-10 validation to eliminate false positives on random 16-digit strings.

**Refinements Made:**
- Added `luhnCheck()` in `src/engine/validators.ts` rejecting non-Luhn 13–19 digit sequences and identical-digit sequences (`0000...`).
- Discovered during unit testing (`src/engine/__tests__/engine.test.ts`) that a naive 12-digit Aadhaar regex matched the first 12 digits of a 16-digit hyphenated order ID (`1234-5678-9012-3456`). Fixed via strict lookahead/lookbehind boundaries (`(?<!\d[\s-])(?<!\d)...(?![\s-]?\d)`) and priority-based overlap resolution (`resolveOverlaps`).
- Added Verhoeff checksum confidence scoring for Aadhaar, entity-type decoding for PAN, and software-version filtering (`v1.2.3.4`) for IPv4.

---

## Prompt Iteration 3 — Three Redaction Modes & CSV Structure Preservation
**Prompt Goal:**  
> Support Full Mask (`[REDACTED]`), Partial Mask (`XXXX-XXXX-1234`, `a***@domain.com`), and Consistent Pseudonymization (`EMAIL_01`, `CARD_01`, `PHONE_01`) while preserving RFC-4180 CSV structure across rows and columns.

**Key Implementation:**
- Built `PseudonymRegistry` (`src/engine/redactors.ts`) with canonical key normalization (`Alice@Corp.com` and `alice@corp.com` -> `EMAIL_01`; `+91 98765 43210` and `9876543210` -> `PHONE_01`).
- Built `parseCsv()` / `sanitizeCsvDocument()` (`src/engine/csv.ts`) sharing one `PseudonymRegistry` across all cells in a CSV table.

---

## Prompt Iteration 4 — Accessible Side-by-Side Diff UI, Testing & Cloud Run
**Prompt Goal:**  
> Build a high-contrast accessible UI featuring a 1-click noisy sample loader, `.txt`/`.csv` upload, live side-by-side diff highlighting, entity counts, Luhn-rejected audit telemetry, 1-click sanitized download, Vitest automated tests, and Google Cloud Run / Firebase hosting configuration.

**Verification & Deliverables:**
- Added automated unit and UI component tests (`src/engine/__tests__/engine.test.ts` and `src/App.test.tsx`).
- Added optional on-device Chrome Built-in AI (`Gemini Nano` / `LanguageModel`) summary over aggregate counts only (`src/engine/chromeAi.ts`).
- Configured multi-stage `Dockerfile` (`nginx.conf.template` listening on `$PORT=8080`) for Google Cloud Run and `firebase.json` for Firebase Hosting.
