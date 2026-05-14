# React “Business” Features: What’s Missing / Incomplete

This note is based on comparing:
- React pages/routes in `react/src/app/router/index.jsx` + navigation in `react/src/shared/components/navigation/Sidebar.jsx`
- Node API routes in `nodejsv2/src/app.js` and `nodejsv2/src/modules/**/**.routes.js`

The React app covers most “business” modules (sales orders, purchase orders, inventory, expenses, receivables/payables, reports, etc.). The main gaps are **feature-level** (missing screens/actions) rather than entire modules.

## High-impact gaps (most likely to cause “missing feature” complaints)

### 1) Stock Adjustments: missing detail/edit/delete flows
**Current UI**
- List + create flows exist: `react/src/modules/inventory/pages/StockAdjustmentsPage.jsx`, `react/src/modules/inventory/pages/StockAdjustmentCreatePage.jsx`
- API calls wired: list/create/submit/approve/reject in `react/src/modules/inventory/api/inventory.api.js`

**What’s missing**
- No “view adjustment details” page (API supports `GET /api/stock-adjustments/:id`).
- No “edit existing adjustment” flow (API supports `PATCH /api/stock-adjustments/:id`).
- No “delete adjustment” action (API supports `DELETE /api/stock-adjustments/:id`).
- Reject uses `window.prompt()` instead of a proper modal input (easy to misclick / hard UX).

**Why it matters**
- Auditing and correction: users often need to open a specific adjustment to review item lines and remarks.
- Operations: draft/pending adjustments commonly require edits before approval.
- Admin cleanup: mistaken adjustments need deletion (when allowed).

**How to implement**
- Add API wrappers:
  - `getStockAdjustmentById(id)`, `updateStockAdjustment(id, payload)`, `deleteStockAdjustment(id)`
  - File: `react/src/modules/inventory/api/inventory.api.js`
- Add pages/routes:
  - `StockAdjustmentViewPage` at `/stock-adjustments/:id`
  - `StockAdjustmentEditPage` at `/stock-adjustments/:id/edit` (or reuse create page with “edit mode”)
  - Route file: `react/src/app/router/index.jsx`
- Replace `window.prompt()` with a small modal (text area) so reject reason is explicit and reviewable.

### 2) Payslips: no “edit payslip amounts/notes” UI
**Current UI**
- Create payslip (modal), list, delete, release/unrelease, view PDF:
  - `react/src/modules/payslips/pages/PayslipsPage.jsx`
  - `react/src/modules/payslips/components/CreatePayslipModal.jsx`

**What’s missing**
- No edit form for an existing payslip (API supports `PATCH /api/payslips/:id`).
- Filters are limited (employee + status). Backend supports date filters in `nodejsv2/src/modules/payslips/payslips.validator.js`.

**Why it matters**
- Real payroll adjustments (late deductions, corrections) happen after initial create.
- Without an edit screen, users either delete/recreate (loses audit trail) or leave wrong data.

**How to implement**
- Add an “Edit” action for draft payslips:
  - Either inline edit modal (recommended) or separate edit page.
- Wire to existing API function `updatePayslip()` in `react/src/modules/payslips/api/payslips.api.js`.
- Add date range filter UI to match backend query (`date_from`, `date_to`).

## Medium-impact gaps (quality-of-life / completeness)

### 3) Global Search: limited navigation targets
**Current UI**
- Global search is implemented in Topbar and calls `GET /api/search/global`:
  - `react/src/shared/components/navigation/Topbar.jsx`
  - `react/src/shared/api/global-search.api.js`

**What’s missing**
- `buildSearchTarget()` maps only a subset of result “types” to screens (hardcoded routes).

**Why it matters**
- Users expect search results to deep-link reliably (payslips, expenses, purchase orders, deliveries, etc.).

**How to implement**
- Expand `buildSearchTarget(item)` to cover all entity types returned by the backend search controller.
- Add missing route mappings (or a generic “search results” page when an item can’t be mapped).

### 4) Consistency: compact currency rounding can mislead
**Current UI**
- KPI cards sometimes show a compact value (e.g. `₱67.8K`) for a “secondary” number.

**Why it matters**
- Rounding to whole `K` can look like the number is wrong (ex: `67,800` appearing as `70K`).

**How to implement**
- Use a “precise compact” formatter for secondary KPIs (1 decimal place, no aggressive rounding).
- File: `react/src/modules/dashboard/pages/DashboardPage.jsx`

## “Modules” that look mismatched (but are mostly naming)

React has folders that don’t match API module folder names 1:1:
- React `expenses/` uses API `business-expenses/`
- React `customer-payments/` uses API `payments/`
- React `agents/` uses API `agent-performance/`
- React `inventory/` uses API `stock-adjustments/` for adjustment workflows

These are not inherently problems, but they can confuse maintenance. If you want to reduce confusion:
- Rename React folders or centralize API wrappers per API module (`/api/business-expenses`, `/api/payments`, etc.).

## Suggested next steps (pick one)
1) Implement Stock Adjustment detail/edit/delete (biggest operational win).
2) Add Payslip edit + date filters (biggest HR/payroll win).
3) Expand Global Search deep-links (biggest navigation win).

