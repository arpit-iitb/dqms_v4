# DQMS v4 — Agent Handover Plan

> **Purpose**: Complete reference for any coding agent to understand what has been built,
> how it works, and exactly what remains to be built with implementation details.
>
> **Project root**: `c:/Users/uparp/Desktop/dqms_v3/dqms_v4/`
> **Stack**: Next.js 16 App Router · TypeScript · Prisma 7 (PrismaPg adapter) · PostgreSQL · shadcn/ui · Tailwind CSS
> **Last verified build**: 52 routes, clean compilation (no TypeScript errors)

---

## 1. Architecture Overview

### Routing
- All pages: `src/app/**/(page|layout).tsx` — App Router, no `pages/` directory
- All API routes: `src/app/api/**/route.ts` — standard Next.js route handlers
- Auth middleware: `src/proxy.ts` — exported as `proxy()`, called from `src/middleware.ts`
- Public paths (no auth needed): `/login`, `/api/auth/*`, `/vendor-portal/*`, `/api/vendor-portal/*`, `/client-portal/*`, `/api/client-portal/*`

### Auth
- JWT in httpOnly cookie named `dqms_token`
- `src/lib/auth.ts` — `signToken(payload)`, `verifyToken(token)` using `jose`
- `src/contexts/auth-context.tsx` — React context, wraps app in `src/app/layout.tsx`
- Roles: `ADMIN`, `OPERATIONS`

### Database
- Prisma config: `prisma/schema.prisma` + `prisma.config.ts` (uses `@prisma/adapter-pg`, no `url` in datasource block)
- Client singleton: `src/lib/prisma.ts`
- **Never use `url` in datasource** — always use the PgAdapter pattern
- Run migrations: `npx prisma migrate dev`

### File Storage
- `src/lib/storage.ts` — stores files under `UPLOAD_DIR` env var (default: `./uploads/`)
- Two subdirs: `originals/` (uploaded files) and `masked/` (AI-sanitized PDFs)
- DB stores **relative** paths like `originals/uuid.pdf`
- `getAbsolutePath(relativePath)` converts to absolute for disk reads

### AI Sanitization
- Python subprocess spawned from `src/app/api/parts/[id]/sanitize/route.ts`
- Requires `GEMINI_API_KEY` env var
- Outputs masked PDF + JSON metadata via stdout

### Zoho Books Integration
- `src/lib/zoho.ts` — OAuth2 client with in-memory token cache, auto-refresh
- `src/lib/zoho-types.ts` — TypeScript interfaces for Zoho responses
- Requires env vars: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ORG_ID`
- All Zoho routes have `export const dynamic = "force-dynamic"` to prevent static caching
- Returns `503` if not configured (`isConfigured()` check)

---

## 2. Database Schema (Complete)

File: `prisma/schema.prisma`

### Key Models & Relationships

```
User                       — auth, roles: ADMIN | OPERATIONS
Client                     — customer companies
Vendor                     — supplier companies
Order                      — has many Parts; status: LEAD → ... → COMPLETED
  └─ Part                  — has Files, Dimensions, ManufacturingPlan, RFQs
       ├─ File              — STEP or DRAWING_PDF; has FileDerivatives (MASKED, RENDER_GLB)
       ├─ Dimension         — critical dimension spec (name, rawText, rect coords)
       ├─ ManufacturingPlan — has ordered PlanBlocks
       │    └─ PlanBlock    — type: MANUFACTURING|INSPECTION|EMAIL|MATERIAL|POST_PROCESSING|REWORK
       │         ├─ InspectionResult  — 1:1, stores PASS/FAIL + inspector type
       │         ├─ BlockDimension    — many per block, links to Dimension + measuredValue + result
       │         └─ StepLog           — audit trail of field changes
       └─ GroupedRFQ        — multi-vendor RFQ for an order's parts
            ├─ GroupedRFQVendor  — one per vendor, has unique accessToken
            │    └─ GroupedPartQuote  — vendor's quote per part
            └─ GroupedRFQPart    — parts included in this RFQ

EmailTemplate              — stored email templates with key/subject/body
ProcessTemplate            — stored manufacturing process templates (steps as JSON array)
```

### Enums
- `OrderStatus`: LEAD, QUOTATION_IN_PROGRESS, RFQ_SENT, QUOTED, CLIENT_PROPOSAL_SENT, ORDER_CONFIRMED, IN_PRODUCTION, INSPECTION, READY_FOR_DISPATCH, DISPATCHED, COMPLETED, LOST, CANCELLED
- `PartState`: DRAFT, FILES_RECEIVED, SANITIZED, RFQ_SENT, QUOTED, PRICED, REJECTED, CLIENT_APPROVED, PLANNED, IN_EXECUTION, COMPLETED, SHIPPED, CLOSED
- `BlockType`: MANUFACTURING, INSPECTION, EMAIL, MATERIAL, POST_PROCESSING, REWORK
- `BlockStatus`: PENDING, IN_PROGRESS, DONE, FAILED
- `InspectorType`: INTERNAL, VENDOR
- `InspectionOutcome`: PASS, FAIL
- `FileType`: STEP, DRAWING_PDF
- `DerivativeType`: MASKED, RENDER_GLB
- `RFQStatus`: SENT, VIEWED, QUOTED, CLOSED

---

## 3. What Is Built (Complete Feature List)

### Pages
| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Redirects to `/dashboard` |
| `/login` | `src/app/login/page.tsx` | Login form |
| `/dashboard` | `src/app/dashboard/page.tsx` | Stats + recent leads + activity |
| `/orders` | `src/app/orders/page.tsx` | All confirmed orders list |
| `/orders/new` | `src/app/orders/new/page.tsx` | New order form |
| `/orders/[id]` | `src/app/orders/[id]/page.tsx` | Order detail with tabs |
| `/orders/[id]/edit` | `src/app/orders/[id]/edit/page.tsx` | Edit order |
| `/parts/[id]` | `src/app/parts/[id]/page.tsx` | Part workspace |
| `/quotations` | `src/app/quotations/page.tsx` | Pre-sales pipeline funnel |
| `/clients` | `src/app/clients/page.tsx` | Client list + create |
| `/vendors` | `src/app/vendors/page.tsx` | Vendor list + create |
| `/settings` | `src/app/settings/page.tsx` | Email & process templates |
| `/vendor-portal/[token]` | `src/app/vendor-portal/[token]/page.tsx` | Public vendor quote portal |

### API Routes
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/clients` | List / create clients |
| GET/PATCH/DELETE | `/api/clients/[id]` | Client CRUD |
| GET/POST | `/api/vendors` | List / create vendors |
| GET/PATCH/DELETE | `/api/vendors/[id]` | Vendor CRUD |
| GET/POST | `/api/orders` | List orders (supports `?pipeline=pre_sales`) / create |
| GET/PATCH/DELETE | `/api/orders/[id]` | Order CRUD |
| GET/POST | `/api/orders/[id]/parts` | List / create parts for order |
| GET/POST | `/api/orders/[id]/rfq` | List / create grouped RFQs |
| GET/POST | `/api/orders/[id]/documents` | Order documents |
| GET/PATCH/DELETE | `/api/parts/[id]` | Part CRUD (state change included) |
| GET/POST | `/api/parts/[id]/files` | List / upload files for part |
| POST | `/api/parts/[id]/sanitize` | AI sanitize a drawing PDF |
| GET/POST | `/api/parts/[id]/dimensions` | List / create critical dimensions |
| GET/POST | `/api/parts/[id]/plan` | Get / create manufacturing plan |
| DELETE | `/api/parts/dimensions/[dimId]` | Delete a dimension |
| DELETE | `/api/files/[id]` | Delete a file |
| GET | `/api/files/[id]/serve` | Stream file from disk |
| GET | `/api/files/[id]/masked` | Stream masked PDF |
| GET/PATCH/DELETE | `/api/plans/[planId]/blocks/[blockId]` | Block CRUD |
| GET/POST | `/api/plans/[planId]/blocks` | List / create blocks |
| GET/POST | `/api/plans/[planId]/blocks/[blockId]/inspection` | Get / upsert inspection result |
| GET/POST | `/api/plans/[planId]/blocks/[blockId]/dimensions` | Get / upsert block dimension measurements |
| GET/POST | `/api/settings/email-templates` | List / create email templates |
| GET/PATCH/DELETE | `/api/settings/email-templates/[id]` | Email template CRUD |
| GET/POST | `/api/settings/process-templates` | List / create process templates |
| GET/PATCH/DELETE | `/api/settings/process-templates/[id]` | Process template CRUD |
| GET | `/api/vendor-portal/[token]` | Get RFQ data for vendor (public) |
| POST | `/api/vendor-portal/[token]` | Submit quotes (public) |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET/POST | `/api/zoho/estimates` | Zoho quotations |
| GET/POST | `/api/zoho/estimates/[id]` | Single estimate + accept |
| GET/POST | `/api/zoho/sales-orders` | Zoho sales orders |
| GET | `/api/zoho/sales-orders/[id]` | Single sales order detail |
| GET/POST | `/api/zoho/invoices` | Zoho invoices |
| GET/POST | `/api/zoho/delivery-challans` | Zoho delivery challans |
| GET | `/api/zoho/contacts` | Zoho vendors list |
| GET | `/api/zoho/estimate-line-items/[id]` | Line items from Zoho estimate |
| GET | `/api/zoho/callback` | OAuth setup / token exchange |

### UI Components
| Component | File | Description |
|-----------|------|-------------|
| `AppLayout` | `src/components/layout/app-layout.tsx` | Sidebar + header wrapper |
| `Sidebar` | `src/components/layout/sidebar.tsx` | Nav links with active state |
| `DashboardView` | `src/components/dashboard/dashboard-view.tsx` | Stats cards + leads table |
| `OrdersView` | `src/components/orders/orders-view.tsx` | Orders table with search/filter |
| `OrderDetail` | `src/components/orders/order-detail.tsx` | Tabs: Info, Parts, RFQ, Dispatch, Docs |
| `OrderForm` | `src/components/orders/order-form.tsx` | Create/edit order form |
| `PartsTab` | `src/components/orders/parts-tab.tsx` | Parts list within an order |
| `OrderRFQTab` | `src/components/orders/order-rfq-tab.tsx` | Grouped RFQ creation + vendor links |
| `OrderDispatchModule` | `src/components/orders/order-dispatch-module.tsx` | Dispatch checklist |
| `OrderDocumentsTab` | `src/components/orders/order-documents-tab.tsx` | PO/SO/Invoice document management |
| `OrderEmailLogTab` | `src/components/orders/order-email-log-tab.tsx` | Email history for order |
| `PartWorkspace` | `src/components/parts/part-workspace.tsx` | Tabs: Info, Manufacturing Steps, Dimensions, Files |
| `StepsTab` | `src/components/parts/steps-tab.tsx` | Plan blocks with execution + inspection panels |
| `FilesTab` | `src/components/parts/files-tab.tsx` | File upload, AI sanitize, view/download |
| `DimensionsTab` | `src/components/parts/dimensions-tab.tsx` | Define critical dimensions for a part |
| `QuotationsView` | `src/components/quotations/quotations-view.tsx` | Pipeline funnel + lead list |
| `ClientsView` | `src/components/clients/clients-view.tsx` | Client CRUD |
| `VendorsView` | `src/components/vendors/vendors-view.tsx` | Vendor CRUD |
| `SettingsView` | `src/components/settings/settings-view.tsx` | Email + process template editors |

---

## 4. What Is NOT Built (Remaining Work)

### 4.1 Block Dimension Measurement UI  ← **HIGHEST PRIORITY**

**What**: During execution of an INSPECTION block, the operator should be able to see all critical dimensions defined for the part and enter a measured value + PASS/FAIL result for each.

**API already exists**: `GET/POST /api/plans/[planId]/blocks/[blockId]/dimensions`

**Where to add**: Inside `src/components/parts/steps-tab.tsx`, in the `BlockCard` component's expanded section, **when** `block.type === "INSPECTION"`.

**Implementation details**:

1. In `StepsTab`, the `PlanBlock` interface already has `blockDimensions?: BlockDimension[]`. You need to add a `BlockDimension` interface:
```typescript
interface BlockDimension {
  id: string;
  dimensionId: string;
  measuredValue: string | null;
  result: "PASS" | "FAIL" | null;
  dimension: { id: string; name: string; rawText: string; dimOrder: number };
}
```

2. Create a `DimensionMeasurementPanel` component (can be in `steps-tab.tsx` or a separate file `src/components/parts/dimension-measurement-panel.tsx`):

```typescript
"use client";
// Props: blockId: string, planId: string
// 1. On mount, fetch GET /api/plans/[planId]/blocks/[blockId]/dimensions
//    → returns { blockDimensions: BlockDimension[] }
//    Also fetch GET /api/parts/[partId]/dimensions to get all part dimensions
//    (need partId — pass it as a prop from StepsTab which already has it via part.id)
// 2. Merge: show ALL part dimensions; for each, pre-fill measuredValue/result if blockDimension exists
// 3. Render a table/list: 
//    columns: # | Dimension Name | Spec (rawText) | Measured Value (input) | Result (PASS/FAIL select) | Save
// 4. On save per row: POST /api/plans/[planId]/blocks/[blockId]/dimensions
//    body: { dimensionId, measuredValue, result }
// 5. Show overall PASS (all PASS) / FAIL (any FAIL) summary badge
```

3. Render `<DimensionMeasurementPanel>` inside the INSPECTION block's expanded section, **below** the existing `<InspectionPanel>`.

4. In `StepsTab`, pass `partId` down — it's already available from the `part` prop or load function. The `planId` is already passed to `StepsTab`.

**Full data flow**:
```
StepsTab (has planId, part.id)
  └─ BlockCard (has block.id, block.type)
       └─ expanded INSPECTION section
            ├─ InspectionPanel (inspector type + overall result)   ← already built
            └─ DimensionMeasurementPanel (per-dimension measured values)  ← TO BUILD
```

---

### 4.2 Process Template "Apply" in StepsTab  ← **HIGH PRIORITY**

**What**: A dropdown/button in `StepsTab` that lets the user pick a saved ProcessTemplate and auto-creates all blocks for the part's manufacturing plan.

**API for process templates**: `GET /api/settings/process-templates` returns:
```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "Standard CNC Part",
      "steps": [
        { "type": "MATERIAL", "processName": "Material Procurement" },
        { "type": "MANUFACTURING", "processName": "CNC Machining" },
        { "type": "INSPECTION", "processName": "Dimensional Inspection" }
      ]
    }
  ]
}
```

**Where to add**: `src/components/parts/steps-tab.tsx`, in the header area of the `StepsTab` component (currently has an "Add Block" button).

**Implementation details**:

1. Add state: `const [templates, setTemplates] = useState<ProcessTemplate[]>([])`
2. Add a "Apply Template" button next to "Add Block" — opens a Dialog
3. In the Dialog: fetch templates from `/api/settings/process-templates`, show a Select/list
4. On confirm: for each step in `template.steps`, call `POST /api/plans/[planId]/blocks` with:
```json
{
  "type": "MANUFACTURING",        // step.type
  "processName": "CNC Machining", // step.processName or step.customName
  "blockOrder": <index>           // sequential, after last existing block
}
```
5. After all blocks created (sequential or Promise.all), call `onUpdate()` to refresh

**Existing block creation API** (`POST /api/plans/[planId]/blocks`):
- Reads `{ type, processName, vendorId, blockOrder }` from body
- Returns `{ block }` with the created PlanBlock

---

### 4.3 Email Sending (SMTP Integration)  ← **MEDIUM PRIORITY**

**What**: The `EmailTemplate` model and Settings CRUD exist but no actual email dispatch is wired.

**Two sending contexts**:
1. **Order-level emails** (from `OrderEmailLogTab`) — send update emails to client using a selected template
2. **Block-level EMAIL trigger blocks** — auto-send when block starts/completes (PlanBlock has `emailEnabled`, `emailRecipient`, `emailTemplate`, `emailTrigger`)

**How to implement**:

1. Install nodemailer: `npm install nodemailer @types/nodemailer`

2. Create `src/lib/email.ts`:
```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@mechximize.com",
    ...opts,
  });
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
    body
  );
}
```

3. Add env vars to `.env.local`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=app-password
SMTP_FROM=noreply@mechximize.com
```

4. Create `POST /api/orders/[id]/email` route:
- Body: `{ templateKey, recipientEmail, variables }`
- Fetch template from DB, render with `renderTemplate()`, call `sendEmail()`, save to `OrderEmailLog`

5. Add "Send Email" button to `OrderEmailLogTab` — opens dialog with template selector + recipient + variable overrides

---

### 4.4 Annotation Tool (PDF Canvas Markup)  ← **LOWER PRIORITY**

**What**: A PDF canvas viewer where operators can draw masks, add notes, and mark critical dimensions directly on the drawing.

**Schema ready**: `Annotation` model exists with `type: MASK | NOTE | CRITICAL_DIM`, `coordinates: Json`, `content: String?`

**API needed**:
- `GET /api/parts/[id]/annotations` — list annotations
- `POST /api/parts/[id]/annotations` — create annotation
- `DELETE /api/parts/annotations/[annotationId]` — delete

**UI approach**:
- Add an "Annotate" tab to `PartWorkspace` in `src/components/parts/part-workspace.tsx`
- Use `react-pdf` (`npm install react-pdf`) to render the DRAWING_PDF
- Overlay a transparent `<canvas>` or SVG for annotation drawing
- Toolbar: Mask (rectangle draw), Note (click to add text), Critical Dim (click to mark)
- On shape complete: save to API with `{ type, coordinates: { x, y, w, h, page }, content }`

---

### 4.5 Client Portal (Quote Acceptance)  ← **MEDIUM PRIORITY**

**What**: The `ClientQuote` model exists (linked to `PricingModel`) but there's no public portal for clients to view and accept quotes.

**Schema**: `ClientQuote` has `accessToken` (unique), `status: SENT | ACCEPTED | REJECTED`, `unitPriceUsd`, `quantity`, `totalPriceUsd`

**What to build**:

1. `GET /api/client-portal/[token]` — find ClientQuote by accessToken (no auth), return quote details + part info
2. `POST /api/client-portal/[token]/accept` — set status to ACCEPTED, update part state to CLIENT_APPROVED
3. `POST /api/client-portal/[token]/reject` — set status to REJECTED, update part state to REJECTED
4. Page: `src/app/client-portal/[token]/page.tsx` — public portal showing quote details with Accept/Reject buttons
5. Already in `PUBLIC_PATHS` in `proxy.ts`: `/client-portal` and `/api/client-portal`

---

### 4.6 Pricing Model UI  ← **MEDIUM PRIORITY**

**What**: The `PricingModel` and `VendorQuote` models exist but there's no UI to set pricing for a part after quotes come in.

**Flow**: Vendor submits GroupedPartQuote → operator selects best quote → sets margin % → locks price → generates ClientQuote

**Where to add**: Add a "Pricing" tab in `PartWorkspace` (`src/components/parts/part-workspace.tsx`), or add a pricing section to the `info` tab.

**API needed**:
- `GET /api/parts/[id]/quotes` — get all GroupedPartQuotes for this part (across all RFQs)
- `POST /api/parts/[id]/pricing` — create/update PricingModel
  - Body: `{ selectedVendorQuoteId, marginPercent }`
  - Calculates: `clientUnitPriceUsd = vendorUnitPrice * (1 + marginPercent/100)`
  - Creates `PricingModel`, updates part state to PRICED
- `POST /api/parts/[id]/pricing/lock` — lock the pricing model
- `POST /api/parts/[id]/pricing/quote` — generate ClientQuote (creates with accessToken)

**UI component**: `src/components/parts/pricing-tab.tsx`
- Table of received quotes: vendor name | unit price | lead time | notes
- Radio to select "winning" quote
- Margin % input with live client price preview
- Save + Lock buttons
- Once locked: show "Generate Client Quote" button → creates ClientQuote and shows shareable link

---

### 4.7 Dispatch Module Completion  ← **LOWER PRIORITY**

**What**: `OrderDispatchModule` exists but uses a basic `Json?` field (`dispatchModule` on Order). Should be formalized with actual delivery challan tracking, Zoho DC integration.

**Current state**: `src/components/orders/order-dispatch-module.tsx` renders dispatch checklist from `order.dispatchModule` JSON

**What to improve**:
- Link Zoho delivery challan creation from this tab (API already exists: `POST /api/zoho/delivery-challans`)
- Store DC numbers in `Order.mechximizeDcNumber` and `Order.clientDcNumber`
- Auto-transition order to DISPATCHED state when DC is created

---

## 5. Environment Variables Reference

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dqms_v4

# Auth
JWT_SECRET=your-secret-here

# File storage
UPLOAD_DIR=/absolute/path/to/uploads

# AI Sanitization
GEMINI_API_KEY=your-gemini-key

# Zoho Books (add when ready)
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORG_ID=

# Email (add when ready)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@mechximize.com
```

---

## 6. Key Patterns & Conventions

### API Route Pattern
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // ALWAYS await params in Next.js 16
  // ...
  return NextResponse.json({ data });
}
```

### Client Component Pattern
```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

export function MyComponent({ id }: { id: string }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/resource/${id}`);
    const d = await res.json();
    setData(d.resource);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  // ...
}
```

### Prisma Upsert with Compound Key
```typescript
await prisma.blockDimension.upsert({
  where: { blockId_dimensionId: { blockId, dimensionId } },
  update: { measuredValue, result },
  create: { blockId, dimensionId, measuredValue, result },
});
```

### shadcn/ui Components Available
`Button`, `Input`, `Label`, `Badge`, `Card`/`CardContent`/`CardHeader`/`CardTitle`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Textarea`, `Alert`/`AlertDescription`, `Separator`, `Checkbox`, `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow`

Lucide icons: import from `lucide-react`

### ID Generation
- Orders: `src/lib/id-generator.ts` — `generateOrderId()` uses `OrderCounter` table
- Parts: drawing counter pattern — `generateDrawingId(prefix)` uses `DrawingCounter` table
- Clients: `src/lib/client-id-generator.ts`

---

## 7. Build Verification

After each change, verify with:
```bash
cd c:/Users/uparp/Desktop/dqms_v3/dqms_v4
npx next build
```

Expected: no TypeScript errors, route count should only increase.

---

## 8. Implementation Status

| # | Feature | Status |
|---|---------|--------|
| 1 | Block Dimension Measurement UI | ✅ DONE |
| 2 | Process Template Apply | ✅ DONE |
| 3 | Pricing Model UI | ✅ DONE |
| 4 | Client Portal (quote accept/reject) | ✅ DONE |
| 5 | Email Sending (SMTP) | ✅ DONE |
| 6 | Dispatch Completion (Zoho DC) | ✅ DONE |
| 7 | Annotation Tool (PDF canvas) | ✅ DONE |
| 8 | EMAIL block config UI (steps-tab) | ✅ DONE |
| 9 | Vendor portal masked drawing download | ✅ DONE |
| 10 | Pre-sales status flow (LEAD→ORDER_CONFIRMED) | ✅ DONE |
| 11 | Zoho order linking dialog (order-detail) | ✅ DONE |
| 12 | Block inline editing (vendor, deadline, notes, status override) | ✅ DONE |
| 13 | Part workspace tab count badges (Files, Dimensions, Annotate, Steps) | ✅ DONE |
| 14 | Completion banner in StepsTab when all blocks done | ✅ DONE |

**ALL CORE FEATURES COMPLETE. Last verified build: 52 routes, 0 errors, 1 NFT warning (2026-04-11).**

## 9. Completed Features Detail

### Email Sending (Phase 5)
- `src/lib/email.ts` — `sendEmail()` (nodemailer), `renderTemplate()` ({{var}} replacement), `textToHtml()` (plain→HTML)
- `POST /api/orders/[id]/email` — sends via SMTP, logs to `OrderEmailLog`, returns 207 if SMTP fails but still logs
- `OrderEmailLogTab` upgraded: "Send Email" button, template selector pills, recipient pre-fill from order context, live variable hints
- **SMTP env vars needed**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### Dispatch Completion (Phase 6)
- `OrderDispatchModule` rewritten: "Create Zoho DC" button opens dialog → calls `POST /api/zoho/delivery-challans`
- DC number auto-saved to `Order.mechximizeDcNumber` and shown in dispatch tab + order header
- Auto status hints: save prompts status transition `READY_FOR_DISPATCH → DISPATCHED → COMPLETED` when relevant checkboxes are ticked
- DC number shown inline on the checklist row after creation

### Annotation Tool (Phase 7)
- `GET/POST /api/parts/[id]/annotations` — list / create annotations
- `PATCH/DELETE /api/parts/annotations/[annotationId]` — update label / delete
- `AnnotationsTab` component: toolbar with 4 modes (Select, Mask, Note, Critical Dim), zoom in/out, show/hide toggle
- Canvas overlaid on PDF iframe (`/api/files/[id]/serve`); mouse drag to draw rectangles
- Annotation sidebar list with label editing (inline input, Enter to save)
- MASK = black overlay, NOTE = yellow highlight, CRITICAL_DIM = red highlight
- Drawing files loaded from `/api/parts/[id]/files`; shows "upload drawing first" if none

## 10. Schema Changes Made After Init Migration

Migration `20260406000000_pricing_model_flexible`:
- `pricing_models.selected_vendor_quote_id` → nullable (was NOT NULL)
- Added `pricing_models.selected_grouped_quote_id TEXT`
- Added `pricing_models.selected_vendor_name TEXT`
- Added `pricing_models.selected_lead_time_days INTEGER`

After any schema change, always run: `npx prisma generate` then `npx next build`

## 11. Remaining Optional Improvements

These are quality-of-life gaps, not missing features:

1. **Dashboard stats API** — ✅ DONE: Includes `pendingClientQuotes`, part completion progress per active order.
2. **Part workspace tab count badges** — ✅ DONE: Files (n), Dimensions (n), Annotate (n), Steps (done/total) shown in tabs. Counts come from data already loaded by `GET /api/parts/[id]`.
3. **PDF annotation persistence across zooms** — current iframe+canvas approach works at fixed A4 size; zooming the iframe separately from the canvas layer could cause misalignment. A production fix would use `react-pdf` to render pages to canvas directly.
4. **Block inline editing** — ✅ DONE: Edit2 button in block card header opens `BlockEditPanel` with process name, vendor selector, deadline date picker, status override, and notes textarea. Vendors loaded lazily from `/api/vendors`.
5. **Plan completion banner** — ✅ DONE: Green banner shown in `StepsTab` when `completedBlocks === totalBlocks > 0`, prompting user to advance part state.
6. **Inspection summary report** — not built. Could generate a PDF/printable view of all dimension measurements (PASS/FAIL) per part for quality records.
7. **Vendor performance analytics** — not built. Which vendors are fastest/cheapest across RFQs.
4. **Email block trigger** — ✅ DONE: Block PATCH route auto-sends email on START/COMPLETE transitions when `emailEnabled=true`. EMAIL-type blocks show `EmailConfigPanel` in the expanded section of StepsTab.
5. **Vendor portal drawing access** — ✅ DONE: Public route `GET /api/vendor-portal/[token]/drawing/[partId]` validates token + RFQ membership, streams masked PDF. Vendor portal UI shows "View Drawing" button per part when available.
