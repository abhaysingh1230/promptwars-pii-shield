export interface SampleDataset {
  id: string
  name: string
  format: 'txt' | 'csv'
  description: string
  content: string
}

/**
 * Fictional sample datasets using standard test card numbers paired with
 * non-Luhn 16-digit order/tracking IDs to demonstrate false-positive rejection.
 */
export const SAMPLE_DATASETS: readonly SampleDataset[] = [
  {
    id: 'incident-logs',
    name: 'Incident logs (fictional)',
    format: 'txt',
    description:
      'Fictional logs with recurring emails, phones, PAN, Aadhaar, test cards & non-Luhn 16-digit IDs',
    content: `[2026-11-27 10:14:22] WARN auth-gateway: Failed login from IP 192.168.14.88 for user rohan.sharma@fintechcorp.in
[2026-11-27 10:14:29] INFO support-ticket #8821: Customer Rohan Sharma (rohan.sharma@fintechcorp.in, +91 98765 43210) reported billing error.
[2026-11-27 10:15:03] DEBUG kyc-check: Verified PAN ABCDE1234F (alt abcpk1234f) and Aadhaar 4512 8890 1234 for primary account holder.
[2026-11-27 10:15:44] INFO payment-init: Card 4111-1111-1111-1111 authorized from client IP 10.24.198.45 (backup IP 2001:db8:85a3::8a2e:370:7334).
[2026-11-27 10:16:12] INFO warehouse-sync: Tracking ref 1234-5678-9012-3456 and batch ID 9988776655443322 dispatched (NOT credit cards).
[2026-11-27 10:17:01] AUDIT escalation: Re-notified rohan.sharma@fintechcorp.in and secondary contact priya.nair@cloudops.org (+44 20 7946 0958) using card 5500 0000 0000 0004.`,
  },
  {
    id: 'hr-csv',
    name: 'HR export .csv (fictional)',
    format: 'csv',
    description:
      'Fictional CSV table with multiline quoted cell, recurring emails, PAN, Aadhaar, and phone numbers',
    content: `employee_id,full_name,email,phone,pan_number,aadhaar_number,client_ip,corporate_card
EMP-101,Aarav Mehta,aarav.mehta@niatdemo.edu,+91 98201 11223,BXZPM4821K,5421 7789 3310,172.16.40.12,4111 1111 1111 1111
EMP-102,"Sneha Kulkarni
Note: Ward SO3",sneha.k@niatdemo.edu,97654 32109,CHNPK9032L,6890 1123 4455,172.16.40.19,5500000000000004
EMP-103,Aarav Mehta (Duplicate),aarav.mehta@niatdemo.edu,9820111223,BXZPM4821K,5421-7789-3310,172.16.40.12,1234567890123456
EMP-104,Vikram Joshi,vikram.joshi@partner.io,+1 (415) 555-0192,DERTJ1122M,7741 9082 6615,203.0.113.77,378282246310005`,
  },
  {
    id: 'clinical-notes',
    name: 'Clinical notes (fictional)',
    format: 'txt',
    description:
      'Fictional healthcare note containing patient identifiers, insurance PAN, and contact info',
    content: `PATIENT INTAKE NOTE — Ward SO3 (Fictional)
Patient Name: Ananya Deshmukh
Primary Email: ananya.deshmukh@healthmail.in
Emergency Email: ananya.deshmukh@healthmail.in
Contact Number: +91 98111 22334 | Alt: 98111 22334
Govt IDs: Aadhaar 3849 2019 4821 | Tax PAN AABCU9603R
Copay Card: 4242-4242-4242-4242 (Luhn Valid)
Lab Specimen Reference: 4000-0000-0000-0001 (16-digit Non-Luhn Lab Barcode)
Portal Access IP: 49.36.128.90`,
  },
  {
    id: 'fintech-kyc',
    name: 'FinTech KYC (fictional)',
    format: 'txt',
    description:
      'Fictional payment audit snippet testing valid cards vs non-Luhn invoice numbers',
    content: `KYC Audit Batch #2026-Q4 (Fictional)
Merchant Admin: compliance@paybridge.in | Reviewer: audit.lead@paybridge.in
Merchant PAN: AAACP1234C | Director PAN: BNZAA2318J
Test Settlement Cards:
  - Visa: 4111111111111111
  - Amex: 378282246310005
  - Mastercard: 5105105105105100
Random 16-digit Invoice / Telemetry IDs (Must NOT Redact):
  - Invoice A: 8472 9104 3381 2048
  - Telemetry B: 6192048172639104
Gateway Nodes: 198.51.100.42 and 198.51.100.42`,
  },
] as const
