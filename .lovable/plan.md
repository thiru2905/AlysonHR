

# Plan: Wire up every button + fix every screen

## Audit results (all 13 modules)

I clicked through every screen. Here's what's broken or missing per module:

| Module | Buttons present | Status |
|---|---|---|
| **Dashboard** | Scenario toggle, KPI drill, forecast click, inbox links | ✓ Works (but headcount KPI metric "headcount" missing from KPI_META map — drawer renders empty) |
| **Team** | Search, dept filter, employee cards | ✗ Cards link to `/team` (loop). No profile drawer. No org-chart toggle. No "Add employee" / "View as chart" buttons. `OrgChart` component exists but is never mounted. |
| **Payroll** | "Wise CSV", "New run", row click | ✗ All 3 buttons are dead. Rows look clickable (`cursor-pointer`) but do nothing. |
| **Performance** | (none) | ✗ No "Start cycle", "Open calibration", "Export" buttons. Rows not clickable. |
| **Leave** | "Request leave" | ✗ Dead button. No tabs for Requests/Approvals/Calendar/Policies. No row drill. |
| **Attendance** | (none) | ✗ No "Sync Time Doctor", "Export hours", or per-row "Adjust" button. |
| **Bonus** | (none) | ✗ No "New plan", "Run simulation", "Approve cycle" buttons. Plan cards not clickable. |
| **Equity** | (none) | ✗ No "New grant", "Board approve", "Export cap table". Rows not clickable — no vesting timeline drill. |
| **Workflows** | Row hover only | ✗ Rows look clickable but nothing happens. No Approve/Reject/Request-changes — `useDecideWorkflow` exists but is never used. |
| **Documents** | "Upload" | ✗ Dead button. Cards not clickable, no preview drawer. |
| **Reports** | Per-card download icon | ✗ All dead. No "Export CSV/Excel", no "Schedule report", no category filter. |
| **Admin** | (none on cards) | ✗ Six cards advertised as clickable (`cursor-pointer`) but none navigate or open anything. No "Manage users" action. |
| **Help** | (none) | ✗ Topic cards look clickable but do nothing. No search. |
| **AppShell** | Bell, Search input, "Ask Alyson" | ✗ Bell does nothing. Search input is decorative. AI panel sends a hard-coded reply instead of calling the existing `streamAlyson` client. |

## Fix strategy — one consistent pattern

Every clickable element gets one of three behaviors, no exceptions:
1. **Navigate** (use `<Link>`)
2. **Open a `<Drawer>`** with details/actions
3. **Open a confirm/form modal** that mutates via Supabase + invalidates the relevant React Query keys + toasts

Every "primary action" button that isn't yet wired to a real backend operation will at minimum open a working drawer (e.g., a "New payroll run" form that inserts into `payroll_runs` and refetches). No more no-op buttons.

## Per-module changes

**Dashboard** — Fix `KPI_META` so `headcount`, `equity6` keys exist. Add `equity3` entry. Wire bell to a notifications popover (lists pending workflows).

**Team** — Add toggle: `[Directory | Org Chart]`. Mount existing `OrgChart` for chart view. Clicking employee card opens an `EmployeeDrawer` with tabs: Overview, Compensation, Payroll, Leave, Reviews, Equity, Audit (each pulls from existing tables). Add "Edit Org / Save Draft / Publish" buttons in chart mode (already supported by `OrgChart`).

**Payroll** — Wire "New run" → drawer form → inserts into `payroll_runs`. "Wise CSV" → builds CSV from rows, downloads. Row click → `PayrollRunDrawer` showing `payroll_items` for that run with status pills + Approve / Reject / Override-amount buttons (override writes `override_reason` + audit log).

**Performance** — Add buttons: "Start review cycle" (modal → `review_cycles` insert), "Open calibration" (drawer with the scatter + draggable rating). Row click → `ReviewDrawer` showing rating, multiplier, comments, and Save/Submit/Calibrate actions.

**Leave** — Tabbed view: `Requests | Approvals | Balances | Calendar | Policies`. "Request leave" → form drawer → `leave_requests` insert. Approvals tab uses `useDecideWorkflow` pattern.

**Attendance** — "Sync Time Doctor" button (mocked: shows toast + last sync time). "Export CSV" wired. Row click → adjust drawer that updates `adjusted_hours` + `adjustment_note`.

**Bonus** — "New plan" → form drawer → `bonus_plans` insert. "Simulate" button per plan → opens BonusSimulationDrawer with editable predictions table. "Approve cycle" → bulk update `bonus_awards.status`.

**Equity** — "New grant" → drawer form → `equity_grants` insert. Row click → `GrantDrawer` showing 8-year vesting timeline chart (built from `vesting_events`) + "Board approve" button.

**Workflows** — Row click → `WorkflowDrawer` with Approve/Reject/Request-changes buttons calling existing `useDecideWorkflow`. Add filter chips: All/Pending/Approved/Rejected/Overdue.

**Documents** — "Upload" → upload drawer (Supabase Storage `documents` bucket, insert into `documents` table). Card click → preview drawer with metadata + tags editable. Add search + tag filter.

**Reports** — Per-row "Export CSV" generates real CSV from the relevant table. Add category filter chips. "Schedule" button → toast "scheduled report queued".

**Admin** — Each card becomes a real route or drawer. Highest priority: "Users & roles" drawer with search → list `profiles` joined with `user_roles` + assign/revoke buttons (writes to `user_roles`, super_admin only).

**Help** — Topic cards expand inline with FAQ content. Add search bar. Link "Contact support" to opening the AI panel.

**AppShell** — Bell → popover listing pending workflows + unread count. Search → command palette (`cmd+k`) routing to any module. AI panel → call `streamAlyson()` with current `location.pathname` as `page` context.

## Technical notes

- All mutations use `useMutation` + `qc.invalidateQueries` + `toast` (sonner already wired)
- All new drawers reuse the existing `<Drawer>` component
- All new forms use plain HTML inputs styled with the existing `surface-card` / `pill` classes — no new UI deps
- New shared components: `EmployeeDrawer`, `PayrollRunDrawer`, `GrantDrawer`, `WorkflowDrawer`, `UploadDrawer`, `NewRunDrawer`, `NewPlanDrawer`, `NewGrantDrawer`, `LeaveRequestDrawer`, `CommandPalette`, `NotificationsPopover`
- CSV export utility: new `src/lib/csv.ts`
- Mobile: every drawer already collapses to full-width on `<sm`

## Out of scope (this turn)

- Real Time Doctor API integration (mocked)
- Real Wise API (CSV download only)
- Document file preview rendering (metadata + download link only)

Approve to proceed and I'll implement all of the above in default mode.

