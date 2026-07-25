# DF7 Billing, GST and Government-Style Documents Update

## Added
- Recurring Billing page
- Mulak School security contract template
- One-click monthly invoice generation
- Duplicate monthly invoice prevention
- Contract, PO/tender reference, service period and due date
- Client name, designation, institution, contact and address
- GST percentage and discount percentage
- Subtotal, discount, taxable amount, GST and grand total
- Registration number and TIN settings
- Bank details, payment terms and authorized signatory
- Scope of work and declaration fields for quotations
- Professional multi-section PDF layout

## Important
The application creates compliance-ready documents, but no software can guarantee that every government office will approve a document. Follow the receiving agency's tender or billing instructions and only charge GST when legally registered and entitled to do so.

## Firebase Rules
After uploading the project, publish the updated `backend/firestore.rules` in:
Firebase Console → Firestore Database → Rules

The new rules allow the `billingContracts` collection and its generated-period records.

## First setup
1. Open Settings.
2. Enter registered business details and TIN.
3. Enable GST Registered only when applicable.
4. Set the correct GST percentage.
5. Enter bank details and authorized signatory.
6. Open Customers and create Mulak School.
7. Open Billing and create the one-year school security contract.
8. Each month, press Create monthly invoice.
