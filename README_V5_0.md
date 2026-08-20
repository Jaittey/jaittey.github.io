# Small Business (SB) v5.0 — Commerce Suite

This is a **manual upgrade package** for the currently working React/Vite/Supabase Small Business app.

It is designed to be copied over the existing `main` branch. It does not replace authentication, subscriptions, company isolation, payment verification, payroll history, or existing business data.

## v5.0 focus

SB v5.0 expands the app from a general small-business ERP into a multi-industry commerce and operations suite for:

- Shops and retail
- Wholesale businesses
- Restaurants and cafés
- Garages and workshops
- Online / marketplace sellers
- Service businesses that also sell goods or parts

## Main additions

### Adaptive POS
On first setup the company chooses the POS type:

- Shop / Retail
- Restaurant / Café
- Garage / Workshop
- Wholesale

The checkout interface and operational tools change according to the selected profile.

### Retail / wholesale inventory
- SKU
- Barcode / GTIN field
- Product category
- Cost price
- Retail price
- Wholesale price
- Minimum wholesale quantity
- Units
- Supplier
- Location
- Low-stock threshold
- Manual stock adjustments
- Stock audit trail

### Purchasing
- Supplier directory
- Purchase orders
- Partial receiving
- Automatic stock increases
- Receipt history

### Restaurant
- Restaurant-specific POS
- Dine-in / takeaway / delivery
- Table selection
- Menu manager
- Modifiers
- Ingredient recipes
- Ingredient stock usage when the bill is paid
- Kitchen orders
- Kitchen Display System: New → Preparing → Ready → Served

### Garage / workshop
- Garage checkout
- Parts + labour/service lines
- Vehicle registration and make/model
- Work notes
- Service-job register
- Technician assignment
- Job statuses
- Estimate totals

### Marketplace / online selling
- Multiple sales-channel records
- Marketplace order inbox
- Manual order entry
- CSV order import by SKU
- Stock validation during fulfillment
- Automatic inventory deduction
- Automatic sales invoice
- Automatic payment record for paid marketplace orders

This is a platform-neutral order hub. Direct API connections to Shopify, Facebook Marketplace, Amazon, eBay, etc. require each platform's API credentials/webhooks and should be connected individually after the base workflow is stable.

### Employee / manager operations
Existing employee, attendance, payroll, salary slip and final-settlement systems remain. Manager default permissions include the full operational workspace allowed by the company subscription.

### Previously planned modules completed
- Supplier directory
- Purchase orders
- HR lifecycle records
- Company asset register
- Restaurant kitchen workspace
- Garage service jobs
- Marketplace orders

## Data model

v5.0 deliberately continues using the existing multi-tenant `business_records` store instead of introducing separate tenant tables. New collections include:

- `stockMovements`
- `suppliers`
- `purchaseOrders`
- `salesChannels`
- `marketplaceOrders`
- `posProfiles`
- `menuItems`
- `restaurantOrders`
- `serviceJobs`
- `hrRecords`
- `assets`

The SQL migration extends `sb_collection_feature()` so the existing RLS policies recognize these collections.
