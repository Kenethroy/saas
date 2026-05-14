# Frontend Skill Guide (JRSPC React)

This guide defines how to build and improve UI in `jrspc-react` with consistent layout, spacing, typography, and behavior.

## 1) Stack + Base Rules

- Framework: React + Vite
- Styling: Tailwind + shared utilities in `src/styles/index.css`
- Data: TanStack Query
- Forms: React Hook Form + Zod
- State: Zustand (global UI/auth/notification only)

Rules:
- Prefer existing shared classes over one-off class strings.
- Keep UI compact and readable (avoid oversized controls and excessive shadows).
- For pages with dynamic data, prioritize loading/empty/error states.

## 2) Page Layout Pattern

Use this structure for module pages:

1. `erp-page-section` for top title/actions area.
2. `erp-page-main-card` for the first main body card directly under the header.
3. `app-shell-card` for secondary cards/side panels.
4. `table-card` for data tables.

Why:
- `erp-page-section` + `erp-page-main-card` now visually join as one grouped block.
- Reduces “floating card” effect and improves hierarchy.

## 3) Shared UI Classes (Use First)

Core containers:
- `app-shell-card`
- `erp-page-section`
- `erp-page-main-card`
- `table-card`
- `erp-form-stack`

Header/filter:
- `erp-page-header`
- `erp-page-title`
- `erp-page-description`
- `erp-page-filters`

Form controls:
- `erp-label`
- `erp-input`
- `erp-select`
- `erp-textarea`
- `erp-date-picker-*`

Actions:
- `erp-button-primary`
- `erp-button-secondary`
- `erp-button-danger`
- `erp-icon-button*`

Tables:
- `erp-table`
- `erp-row-actions`
- `erp-empty-state`

## 4) Forms and Data Entry

- Use React Hook Form + Zod for create/edit pages.
- Keep labels short and upper/lower casing consistent with existing pages.
- Validate required fields with clear, short messages.
- Prevent invalid actions while loading/submitting (`disabled` states).
- Always show a deterministic empty state for no selectable records.

## 5) Dynamic Data UX

For API-driven pages:
- Loading: use `Skeleton` placeholders.
- Empty: meaningful no-data message + next-step hint.
- Error: compact bordered alert with actionable message.
- Success actions: use notification store hooks where applicable.

## 6) Typography and Density

- Target compact admin density:
- Body text around `12px–14px`
- Labels around `10px–11px`
- Primary page title around `15px`
- Avoid oversized paddings unless needed for readability.

## 7) Visual Hierarchy Guidelines

- Keep one dominant surface per section (avoid nested heavy cards).
- Use subtle borders and low-elevation shadows only.
- Group related controls in a shared surface before adding sub-panels.
- Use color accents for state/action emphasis, not for every element.

## 8) File Organization Pattern

Module convention:
- `src/modules/<module>/pages/*`
- `src/modules/<module>/api/*`
- `src/modules/<module>/hooks/*`
- `src/modules/<module>/utils/*`

Shared:
- `src/shared/components/common/*`
- `src/shared/api/client.js`
- `src/shared/store/*`
- `src/styles/index.css`

## 9) UI Change Checklist (Before Merge)

1. Uses shared utility classes first (no unnecessary one-off classes).
2. Header/body grouping is visually coherent.
3. Buttons/inputs are consistent size and typography.
4. Loading, empty, and error states are present.
5. Works on mobile and desktop widths.
6. Build passes with `npm run build`.

## 10) Commands

```bash
npm install
npm run dev
npm run build
```

