# CCTEK Third-Party Inspection & Billing — Build Plan

## 1. What the Excel files do today

**Workbook A — Register** (`2018-2019` … `2025-2026`, one sheet per year, ~2,150 rows in 2025-26)

One row = one application from a party (MCC 2,083 rows; Pilikula 28; Kateelu 8; NMPA, Ambedkar, Venloc 1 each).

| Columns | Meaning |
|---|---|
| Sl No, Ledger No (365 → 369 when a ledger fills at page 150), Page No, App No (text, e.g. `57/1`), App date | Paper inward register reference |
| Party, Ward, File, Year, MB | Client and its work-order reference |
| **Engg Name / Contractor Name** | **Headers are swapped**: "Engg Name" holds contractors (Rahul Builders, Raviraj Electronics…), "Contractor Name" holds MCC engineers (Priyanka, Yathish V S…) |
| Project Bill Amt (N) | Contractor's bill being inspected |
| O..AA | CCTEK fee and its split (formulas below) |
| Insp Date (AC), AD | AD = `IF(AppDate > InspDate, 1, 0)`: a data-error flag |
| AE, AF | Helper encoding of the team: AE = number of inspectors, AF = their column positions joined (`24` = inspectors in columns 2 and 4, `412` = 4 and 12) |
| Insp by name 1..14 | One fixed column per person (1 Deepak G Talekar, 2 Vishwanath Mane, 3 Jayashree, 4 Ravindra M Keni, 5 Devaraju D, 6 Chethan H G, 7 Mayur Kotharkar, 8 Santhosh Jude Fernadis, 9 Sathish S, 10 Harish C P, 11 Pavithra Kumar M, 12 Thripthika M) |
| Remarks | "Certificate Not Issued", "Cancelled As Date Mismatch" |
| bottom of sheet | Bill Prepared / Bill Received / Pending per party |

2023-24 also had `Report Date, Service bill No/Date, Receipt No/Date/Amt/Type, Status`. These were dropped later, which is why "Bill Received" for MCC 2025-26 shows 0.

**Formulas (2025-26), now in `backend/src/services/billingService.js`:**

```
O  Service %  = Bill >= 10,00,000 → 0.8 | >= 2,00,000 → 0.7 | else 0.5   (or "lumpsum")
P  Claimed    = ROUND(Bill × O%, 0)
R  Net        = P × 100/118  (GST inclusive: MCC)   |  P  (GST exclusive: Pilikula/Kateelu)
Q  GST        = P − R                               |  P × 18%
T  TA         = KM × ₹15
U  Amount     = R − T
V 45% inspectors · W 10% support staff · X 25% admin & infra · Y 20% profit
Z  DTE 25% of Y · AA CCTEK 75% of Y
```

The engine was checked against **all 2,123 formula rows of the 2025-26 sheet: 2,119 match exactly**. The other 4 are lumpsum jobs entered without the "lumpsum" label.

**Workbook B: monthly "Resource Persons Remuneration Bill"** (`Apr 23` … `Mar24`, `Sheet14`, `VM TDS`, `VM TA`): the paid certificates of a month → the same split → per-person amounts (Inspection Officer 45%, Accompanying staff 10% split 5/5, TA, Admin 25%) → the balance split DTE 25% / Reserve 10 / Student Welfare 15 / Staff Welfare 18 / Infrastructure 20 / WID 5 / Environment 2 / R&M 2 / Contingencies 3. Then a yearly per-person total for TDS.

### Errors found in the sheets (the app removes these)

1. 2025-26 summary block: columns are shifted. "Profit" holds `SUM(V:X)` (the 80%), and "DTE 25%" holds the profit.
2. `Sheet2` consolidated row: `E34 = C27+E21…`, `F34 = D27+F21…` (wrong column for 2020-21), so consolidated totals are wrong.
3. Pending row uses 42% / 8% while the register uses 45% / 10%. Sheet2 2024-25 uses a different split (42/10/3/5/20).
4. May-23 remuneration: row Course Fund subtracts GST, but the total (`H10 = D10 − G10`) does not. People were paid on the GST portion.
5. The 2025-26 summary is labelled "2024-2025".
6. Duplicate serial numbers (1135, 1299, 1780, 1938 ×4), and dates such as `13-05-2002` and `10/12/20256`.
7. Placeholder rows 152–157 with no data.

## 2. Workflow the app automates

```
Party sends work ──► RECEIVED (register entry, auto serial no.)
                      │ coordinator allots team
                      ▼
                   ASSIGNED ──► faculty sees it on phone
                      │ site visit, photos, inspection date
                      ▼
                   INSPECTED
                      │ report/certificate PDF uploaded, sent to party
                      ▼
                 REPORT_ISSUED
                      │ accounts groups reported jobs per party → bill (draft)
                      ▼            approver approves → number + PDF frozen
                    BILLED ──► receipts recorded (partial allowed)
                      ▼
                     PAID ──► monthly payout run: per-person shares, funds, DTE
   (ON_HOLD / CANCELLED at any early step, with a reason)
```

## 3. Architecture

- **frontend/**: Next.js 16 (App Router), Clerk (Google only), axios, Tailwind 4, neumorphism utilities in `globals.css` (`neu-raised`, `neu-inset`, `neu-primary`, `neu-press`). It is a PWA, so it installs on phones.
- **backend/**: Express 5 + Mongoose 9 on MongoDB Atlas, Clerk token verification, Cloudinary for reports/photos (authenticated delivery, not public URLs).
- **Mobile**: phase 1 is the PWA (same code, "Add to Home screen", camera upload works). Phase 2 is an optional Expo React Native app using `@clerk/clerk-expo` against the **same API**. That is why every rule lives in the backend.

### Data model (`backend/src/models`)

| Model | Purpose |
|---|---|
| `User` | Pre-registered person: email, role, `isActive`, PAN (for TDS). `clerkId` is linked on first Google login |
| `Party` | Client; `gstMode` inclusive/exclusive, GSTIN, billing address |
| `BillingRule` | Versioned slabs/GST/TA/shares/profit split/fund allocation with `effectiveFrom` |
| `Project` | One application; team[], status + history, report, frozen `charges` snapshot |
| `Bill` | Per-party service bill; frozen lines; draft → approved → sent → partially_paid → paid |
| `Receipt` | Payment against a bill (NEFT/cheque…, TDS deducted by party, reversal) |
| `Payout` | Monthly distribution; unique index stops a project being paid out twice |
| `AuditLog` | Append-only (updates/deletes blocked in the model) |
| `Counter` | Atomic per-year numbering for serial / bill / receipt numbers |

## 4. Security model (no repeated OTP)

| Layer | What it does | File |
|---|---|---|
| Sign-in | Google via Clerk only. Disable email/password and phone in the Clerk dashboard. Clerk handles session expiry and revocation | Clerk dashboard |
| Allow-list | Unknown Google accounts get 403. Admin registers email + role, and the link is made by **verified** email on first login | `middlewares/requireAuth.js` |
| Single source of role | MongoDB only; Clerk metadata is ignored | same |
| Kill switch | `isActive=false` blocks immediately | same |
| Page access | `proxy.js` blocks every non-public URL before render | `frontend/proxy.js` |
| API authorization | Every route: `authenticateUser` + `requirePermission(...)` | `config/roles.js`, `middlewares/requireRole.js` |
| Row-level | Faculty only see projects where they are in `team` (enforce in queries) | project controller (step 3) |
| Input | Field whitelists (no mass assignment), `sanitizeFilter` (NoSQL injection), regex escaping, size limits | `utils/validate.js`, `server.js` |
| Transport/headers | Helmet (CSP none, HSTS, no sniff/frame), Next security headers, strict CORS list | `server.js`, `next.config.mjs` |
| Abuse | Rate limits: 300 req/min per IP, 60 writes/min | `server.js` |
| Money integrity | Integer paise; rule snapshot per project; approved bills immutable (cancel + reissue); approval by a different user than the preparer | models + step 5 |
| Files | Cloudinary `type: "authenticated"`, short-lived signed URLs, PDF/JPG/PNG only, size cap | step 4 |
| Traceability | Audit entry for every money/role change, with IP | `models/AuditLog.js` |
| URLs | Mongo ObjectIds (not guessable sequences) in URLs, and ownership checked server-side anyway | all controllers |

## 5. Step-by-step

### Step 0: one-time setup (do this now)
1. **Clerk dashboard → User & Authentication**: enable **Google** only; turn off Email/Password, Phone, and **Sign-ups** ("Restricted" mode) so only invited/registered emails can create a Clerk account.
2. Clerk → Sessions: lifetime 7 days, inactivity timeout 12 hours (sign-in stays smooth on phones, with no OTP).
3. `backend/.env`: confirm `FRONTEND_URLS=https://your-domain,http://localhost:3000`.
4. Rotate secrets if `.env` was ever committed or shared (`CLERK_SECRET_KEY`, `MONGO_URI` password, Cloudinary secret).
5. Register yourself as first admin:
   ```powershell
   cd backend
   $env:ADMIN_EMAIL="you@gmail.com"; $env:ADMIN_NAME="Your Name"; npm run seed
   ```
   This also creates the 7 parties and fee rule `TPI-2025`. Check each party's GST mode.
6. Delete unused files left from the exams app: `src/services/stepUp.js` (OTP), `src/controllers/userController.js`, `src/routes/userRoutes.js`, and the empty `FacultyAssignment.js` / `assignment*` files. The new user code is `accountController.js` / `accountRoutes.js`.

### Step 1: done in this session (foundation)
Security middleware, allow-list auth, permissions, models, billing engine (verified against Excel), seed, `proxy.js`, neumorphism tokens. Pre-existing frontend build errors were fixed (`new Date()` on the landing page, and `<SignIn>` without `<Suspense>`).

### Step 2: frontend API client + shell
- `frontend/lib/api.js`: axios instance using `NEXT_PUBLIC_API_URL`, attaching `await getToken()` on each request, and redirecting to `/auth/check` on 401/403.
- `/auth/check` → `HOME_BY_ROLE`. Update `menus.js` to the real roles: `manager, office_staff, work_coordinator, accounts, approver, auditor, faculty`.
- Neumorphic shell: sidebar (desktop) + **bottom tab bar (mobile)**, `components/ui/` (Card, Button, Input, Select, Badge, Table→card-list on mobile, MoneyText).
- Users screens wired to `GET/POST/PATCH /api/users`.

### Step 3: Projects (register)
**Partly done:** inward scan → AI extraction (Claude, `ANTHROPIC_API_KEY`) → staff review → save, at `/office/incoming` (and `/admin/projects/new`); register list at `/office/register`. Scans are stored as private Cloudinary assets, viewed through 5-minute signed links. Still to do: edit, assign team, status changes.

- Backend `projectController/projectRoutes`:
  - `POST /api/projects` (projects.create): serial from `Counter`, `gstMode` from party, charges calculated with `ruleForDate(appDate)`.
  - `GET /api/projects` with filters (FY, party, status, contractor, date range, my-jobs) and pagination. Faculty are forced to `team.user = me`.
  - `PATCH /api/projects/:id` with a whitelist. Charges are recalculated until billed, then locked.
  - `POST /api/projects/:id/assign` (projects.assign): team with inspector/support roles.
  - `POST /api/projects/:id/status` following `STATUS_FLOW`, with history + audit.
- Frontend: register table with filters, new-application form showing a live fee preview (same engine), and a project detail timeline.

### Step 4: Faculty mobile flow + reports
- "My inspections" list (PWA), mark inspected with date, upload photos/report.
- `POST /api/projects/:id/report`: multer memory storage, 10 MB, mime + magic-byte check, Cloudinary `authenticated` upload; `GET …/report-url` returns a 5-minute signed URL.
- Optional: email the report PDF to the party contact.

### Step 5: Bills
- `POST /api/bills` (billing.prepare): select REPORT_ISSUED projects of one party → draft with frozen lines.
- `POST /api/bills/:id/approve` (billing.approve, **must differ from preparer**): bill number `CCTEK/2025-26/0001`, PDF generated server-side (`pdfkit`), projects → BILLED. Mongo transaction.
- `POST /api/bills/:id/cancel` with a reason: projects back to REPORT_ISSUED.

### Step 6: Receipts
- `POST /api/receipts` (receipts.manage): amount ≤ balance, TDS by party, mode/UTR. Bill → partially_paid/paid, projects → PAID when the bill is fully paid. Reversal flow for bounced cheques.

### Step 7: Payouts (distribution)
- `POST /api/payouts` for a month: PAID projects not yet paid out → 45% pool split equally among that job's inspectors (`splitAmong`), 10% among support, TA to the person who travelled, funds/DTE/CCTEK from the rule; TDS per person.
- Approve, then export the remuneration statement (PDF/XLSX) like today's sheets. Faculty see "My earnings".

### Step 8: Dashboards & reports
- Per party / FY: Bill Prepared vs Received vs Pending (fixing the summary errors), ageing of unpaid bills, inspector workload, monthly income, fund balances. Export to Excel.

### Step 9: Import old data
- `scripts/importRegister.js` reads each year sheet → Party/Project. Team from "Insp by name" columns, status from Remarks, receipts from the 2023-24 receipt columns. It produces a report of the bad rows listed in section 1 for manual correction.

### Step 10: Deploy & harden
- Backend and frontend on Vercel (or backend on Render). Atlas: IP access list, a DB user with least privilege, backups on.
- PWA manifest + icons; then evaluate the Expo app.
- Run `npm audit`, add tests for billingService (the Excel verification as a fixture) and for permissions.

## 6. Open questions (answers change the rules, not the structure)

1. When 2 inspectors attend, is the 45% split **equally**? Is the 10% always for named support staff (e.g. Harish/Suraj 5% each), or does it go to a pool?
2. Which split is current: **45/10/25/20** (register) or **42/10/3/5/20** (Sheet2, 2024-25)?
3. GST mode per party: is MCC always inclusive and Pilikula/Kateelu always exclusive? (Kateelu has 5 exclusive and 3 inclusive rows.)
4. Is one bill raised per application, or one bill per party per month for many applications?
5. Is TDS deducted from inspectors' remuneration, and at what rate?
6. Who approves bills and payouts: Manager, Principal (approver role), or both?
