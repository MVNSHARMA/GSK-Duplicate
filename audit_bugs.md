# GSK Automotive — Comprehensive System Audit & Bug Inventory (`audit_bugs.md`)

This document serves as the master registry of all security vulnerabilities, production crash bugs, performance/scaling bottlenecks, memory leaks, redundancies, and dead code identified across the **GSK Automotive** codebase.

Each issue is documented with its **Severity**, **Category**, **Exact File & Line Location**, **Technical Root Cause**, **Business & Security Impact**, and **Recommended Remediation Code**.

---

## 1. Executive Summary & Issue Matrix

| ID | Severity | Category | Title | Primary File | Status |
|:---:|:---:|:---:|---|---|:---:|
| **SEC-01** | 🔴 Critical | Security | Public Unauthenticated Database Dump & PII Leak | `backend/src/routes/intakeRoutes.js` | Resolved |
| **SEC-02** | 🔴 Critical | Security | CORS Wildcard Subdomain Trust with Credentials | `backend/src/app.js` | Resolved |
| **BUG-01** | 🔴 Critical | Functional Crash | Customer Portal Invoice Detail Crashes with 500 (`TypeError`) | `backend/src/controllers/customerPortalController.js` | Resolved |
| **PERF-01**| 🔴 Critical | Scaling / Database | Broken `Booking` Index Causing Full Collection Scans (COLLSCAN) | `backend/src/models/Booking.js` | Resolved |
| **SEC-03** | 🟠 High | Access Control | Workshop Technician PII Exposed to Customer Portal Users | `backend/src/routes/adminRoutes.js` | Resolved |
| **SEC-04** | 🟠 High | Denial of Service | Missing Rate Limiting on Password Reset & Intake Endpoints | `backend/src/routes/authRoutes.js`, `intakeRoutes.js` | Resolved |
| **BUG-02** | 🟠 High | Data Integrity | `invoiceNumber` Undefined in Customer Portal DTO & PDF Download | `backend/src/controllers/customerPortalController.js` | Resolved |
| **PERF-02**| 🟠 High | Scaling / Database | `Quote` and `Contact` Models Have Zero Database Indexes | `backend/src/models/Quote.js`, `Contact.js` | Resolved |
| **SEC-05** | 🟡 Medium | ReDoS | Unescaped User Search Input in `new RegExp(search, 'i')` | Multiple (6+ Controllers) | Resolved |
| **MEM-01** | 🟡 Medium | Memory / Serverless | In-Memory Deduplication Locks Ineffective & Stale on Vercel | `invoiceController.js`, `communicationsController.js` | Resolved |
| **MEM-02** | 🟡 Medium | Memory Leak | Linear Heap Memory Explosion on Trash Multi-Collection Pagination | `backend/src/controllers/trashController.js` | Resolved |
| **BUG-03** | 🟡 Medium | Functional | Broken Query Filter for `associatedVehicles` on Customers API | `backend/src/controllers/customerController.js` | Resolved |
| **BUG-04** | 🟡 Medium | Client UX | Monkey-Patched `window.fetch` Forces Hard Page Reload on 401 | `frontend/src/context/AuthContext.jsx` | Resolved |
| **DEAD-01**| 🟢 Low | Dead Code | Unmounted Legacy Routes (`saleRoutes.js`, `importTrackerRoutes.js`) | `backend/src/routes/` | Resolved (Orphaned Controller Snippets Removed) |
| **DEAD-02**| 🟢 Low | Repository Clutter| 50+ Stray Test Scripts, Patch Files & Debug Dumps | Root & `backend/` | Reviewed |

---

## 2. Detailed Bug & Vulnerability Breakdown

### SEC-01: Public Unauthenticated Database Dump & Customer PII Leak

- **Severity:** 🔴 **Critical** (CVSS 9.1 - Unauthenticated PII Disclosure & Resource Exhaustion)
- **File:** [`backend/src/routes/intakeRoutes.js#L10`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/routes/intakeRoutes.js#L10)
- **Controller:** [`backend/src/utils/audit.js#L10-L64`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/utils/audit.js#L10-L64)

#### Root Cause
In `backend/src/routes/intakeRoutes.js`:
```javascript
const router = express.Router();

router.get('/audit', runAudit); // Exposed on public unauthenticated intake router!
```
The handler `runAudit` performs unbounded queries:
```javascript
export const runAudit = async (req, res) => {
    const customers = await Customer.find({});
    const vehicles = await Vehicle.find({});
    const trackers = await ImportTracker.find({});
    const rentals = await RentalServiceEntry.find({});
    ...
    const emails = customers.map(c => c.email).filter(Boolean);
    const duplicateEmails = emails.filter((item, index) => emails.indexOf(item) !== index);
    if (duplicateEmails.length > 0) issues.push({ type: 'DUPLICATE_CUSTOMERS', data: [...new Set(duplicateEmails)] });
    ...
    res.json({ success: true, counts, issues });
};
```

#### Security & Operational Impact
1. **Public Information Disclosure:** Anyone on the public internet sending `GET /api/intake/audit` receives exact counts of all customers, vehicles, rental entries, and import trackers, plus unmasked customer email addresses.
2. **Denial of Service (DoS):** An attacker calling this endpoint repeatedly forces Node.js to pull the entire database into memory, causing heap exhaustion and crashing the serverless worker.

#### Remediation
Remove `runAudit` from `intakeRoutes.js`. If required for diagnostic purposes, relocate it to `adminRoutes.js` guarded by `protect` and `authorizeRoles('super_admin')`:
```javascript
// Remove from backend/src/routes/intakeRoutes.js
- router.get('/audit', runAudit);
```

---

### SEC-02: Overly Permissive CORS Subdomain Matching with Credentials

- **Severity:** 🔴 **Critical** (CVSS 8.5 - Cross-Origin Request Forgery / Origin Spoofing)
- **File:** [`backend/src/app.js#L58-L62`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/app.js#L58-L62)

#### Root Cause
```javascript
// Allow any Vercel deployment URL dynamically
if (origin.endsWith('.vercel.app')) {
    return callback(null, true);
}
```
Combined with:
```javascript
app.use(cors(corsOptions));
credentials: true
```

#### Security Impact
Any third-party user who deploys a site on Vercel (e.g. `https://attacker-app.vercel.app`) is automatically treated as an authorized origin. If a workshop manager or customer is logged in and visits that malicious site, the attacker's script can issue authenticated requests with credentials against the GSK Automotive API.

#### Remediation
Replace suffix matching with a strict regex that matches only GSK Automotive's official project slugs:
```javascript
const GSK_VERCEL_REGEX = /^https:\/\/gsk-automotive([a-z0-9-]*)\.vercel\.app$/;

if (GSK_VERCEL_REGEX.test(origin)) {
    return callback(null, true);
}
```

---

### BUG-01: Customer Portal Invoice Detail Crashes with 500 (`TypeError`)

- **Severity:** 🔴 **Critical** (Production Runtime Crash)
- **File:** [`backend/src/controllers/customerPortalController.js#L407-L415`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/controllers/customerPortalController.js#L407-L415)

#### Root Cause
In `getInvoiceById`:
```javascript
// For detail view, we include lineItems in the DTO
const invoiceDTO = mapInvoiceDTO(invoice);
invoiceDTO.lineItems = invoice.lineItems.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice
}));
```
In `backend/src/models/Invoice.js`, the schema defines:
```javascript
partsAndLabour: [
    {
        inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        variantId: { type: mongoose.Schema.Types.ObjectId },
        description: { type: String },
        qty: { type: Number, default: 1 },
        price: { type: Number, default: 0 }
    }
]
```
The field is named **`partsAndLabour`**, NOT `lineItems`. Furthermore, the subdocument fields are **`qty`** and **`price`**, NOT `quantity` and `unitPrice`. Because `invoice.lineItems` is `undefined`, JavaScript throws:
`TypeError: Cannot read properties of undefined (reading 'map')`.

#### Operational Impact
**100% of customer portal requests to view invoice details (`GET /api/customer-portal/invoices/:id`) fail with an internal 500 server error.**

#### Remediation
Update lines 407–415 in `customerPortalController.js`:
```javascript
const invoiceDTO = mapInvoiceDTO(invoice);
invoiceDTO.lineItems = (invoice.partsAndLabour || []).map(item => ({
    description: item.description || 'Service / Part',
    quantity: item.qty || 1,
    unitPrice: item.price || 0,
    totalPrice: (item.qty || 1) * (item.price || 0)
}));
```

---

### PERF-01: Broken Index on `Booking.js` Causing Full Collection Scans (COLLSCAN)

- **Severity:** 🔴 **Critical** (High-Volume Database Scaling Bottleneck)
- **File:** [`backend/src/models/Booking.js#L63`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/models/Booking.js#L63)

#### Root Cause
```javascript
bookingSchema.index({ date: 1, time: 1 }); // Indexes non-existent top-level fields!
```
In `Booking.js`, appointment timing is nested:
```javascript
appointment: {
    date: { type: String, required: true },
    time: { type: String, required: true }
}
```

#### Operational Impact
All queries in `intakeController.js` (slot locking), `slotController.js` (checking available capacity), and `cronController.js` (daily reminders) query `{ 'appointment.date': date, 'appointment.time': time }`.
Because the index was defined on top-level `date` and `time`, **every query executes an unindexed full collection scan (COLLSCAN)**. As the database grows to thousands of bookings, booking intake and cron executions degrade significantly in latency.

#### Remediation
Fix the compound index definition in `backend/src/models/Booking.js`:
```javascript
- bookingSchema.index({ date: 1, time: 1 });
+ bookingSchema.index({ 'appointment.date': 1, 'appointment.time': 1 });
```

---

### SEC-03: Workshop Technician PII Leaked to Customer Portal Users

- **Severity:** 🟠 **High** (Broken Object / Function Level Authorization)
- **File:** [`backend/src/routes/adminRoutes.js#L29-L30`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/routes/adminRoutes.js#L29-L30)

#### Root Cause
```javascript
router.use(protect);

router.route("/technicians")
  .get(getTechnicians); // Missing authorizeRoles / requirePermission
```
`getTechnicians` queries:
```javascript
const technicians = await User.find({ role: "mechanic", status: "active" })
  .select("name email phone");
```
Because only `protect` is applied, any user with a valid JWT (including public customer users with `role: 'user'`) can call `GET /api/admins/technicians`.

#### Security Impact
Enables customer portal accounts to scrape internal staff lists, employee personal contact numbers, and email addresses.

#### Remediation
In `backend/src/routes/adminRoutes.js`:
```javascript
- router.route("/technicians").get(getTechnicians);
+ router.route("/technicians").get(authorizeRoles('admin', 'super_admin'), getTechnicians);
```

---

### SEC-04: Missing Rate Limiting on Password Reset & Public Intake

- **Severity:** 🟠 **High** (Resource Depletion & Abuse Vector)
- **Files:** [`backend/src/routes/authRoutes.js#L17`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/routes/authRoutes.js#L17), [`backend/src/routes/intakeRoutes.js#L12-L14`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/routes/intakeRoutes.js#L12-L14)

#### Root Cause
`loginLimiter` is only applied to `/login` and `/register`.
The endpoints:
- `POST /api/auth/forgotpassword`
- `POST /api/intake/book`
- `POST /api/intake/quote`
- `POST /api/intake/contact`
have no rate limiting attached.

#### Security Impact
1. **Brevo Email Quota Exhaustion:** Automated bots can flood password resets or quotes to deplete transactional email quotas.
2. **Denial of Service via Cloudinary & Database:** Attackers can submit automated high-volume bookings with multiple 10MB images, clogging appointment slots and exhausting storage.

#### Remediation
Create and attach rate limiters for intake and password resets:
```javascript
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: "Too many password reset requests. Please wait 15 minutes." }
});

const intakeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: { success: false, error: "Submission limit reached. Please try again shortly." }
});

router.post("/forgotpassword", passwordResetLimiter, forgotPassword);
router.post('/book', intakeLimiter, upload.array('images', 5), createBooking);
router.post('/quote', intakeLimiter, upload.array('images', 5), createQuote);
router.post('/contact', intakeLimiter, submitContact);
```

---

### BUG-02: `invoiceNumber` Undefined in Customer Portal DTO & PDF Downloads

- **Severity:** 🟠 **High** (Data Display & File Integrity Bug)
- **File:** [`backend/src/controllers/customerPortalController.js#L70`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/controllers/customerPortalController.js#L70) & [`#L449`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/controllers/customerPortalController.js#L449)

#### Root Cause
In `mapInvoiceDTO`:
```javascript
const mapInvoiceDTO = (invoice) => {
    return {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber, // Undefined! In Invoice model it is `invoiceNo`
```
And in `downloadInvoicePDF`:
```javascript
const fileName = `Invoice_${invoice.invoiceNumber}.pdf`; // Becomes "Invoice_undefined.pdf"
```

#### Operational Impact
Customers viewing invoices in their dashboard see missing invoice numbers, and PDF downloads are saved as `Invoice_undefined.pdf`.

#### Remediation
In `customerPortalController.js`:
```javascript
- invoiceNumber: invoice.invoiceNumber,
+ invoiceNumber: invoice.invoiceNo || invoice.invoiceNumber,
```
and:
```javascript
- const fileName = `Invoice_${invoice.invoiceNumber}.pdf`;
+ const fileName = `Invoice_${invoice.invoiceNo || 'Document'}.pdf`;
```

---

### PERF-02: `Quote` and `Contact` Models Have Zero Database Indexes

- **Severity:** 🟠 **High** (Query Latency & Unindexed Collections)
- **Files:** [`backend/src/models/Quote.js`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/models/Quote.js), [`backend/src/models/Contact.js`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/models/Contact.js)

#### Root Cause
Neither model contains any `schema.index(...)` calls.

#### Operational Impact
As quote requests and customer inquiries accumulate, every query in `/admin/communications` filtering by status, customer, or creation date performs a full collection scan.

#### Remediation
Add indexing declarations:
```javascript
// In Quote.js:
quoteSchema.index({ status: 1 });
quoteSchema.index({ customerId: 1 });
quoteSchema.index({ vehicleId: 1 });
quoteSchema.index({ isActive: 1, createdAt: -1 });

// In Contact.js:
contactSchema.index({ status: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ customerId: 1 });
contactSchema.index({ isActive: 1, createdAt: -1 });
```

---

### SEC-05: Regular Expression Denial of Service (ReDoS) Vulnerabilities

- **Severity:** 🟡 **Medium** (CWE-1333 - ReDoS / Node Event Loop Freeze)
- **Files:**
  - `backend/src/controllers/customerController.js` (Lines 37, 155)
  - `backend/src/controllers/customerPortalController.js` (Line 218)
  - `backend/src/controllers/inventoryController.js` (Line 731)
  - `backend/src/controllers/rentalServiceEntryController.js` (Line 286)
  - `backend/src/controllers/trashController.js` (Line 32)
  - `backend/src/controllers/vehicleBatchController.js` (Line 211)

#### Root Cause
User search input is passed directly to the `RegExp` constructor without sanitizing regex metacharacters:
```javascript
const searchRegex = new RegExp(search.trim(), 'i');
```

#### Security Impact
If an attacker sends a string containing unescaped special characters or nested quantifier repetitions (e.g. `(a+)+$`), the V8 regular expression engine enters catastrophic backtracking, blocking the single-threaded Node.js event loop and preventing the server from handling other requests.

#### Remediation
Export and use a centralized regex escaping function:
```javascript
// In backend/src/utils/sanitize.js
export const escapeRegex = (string = '') => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
```
And replace calls:
```javascript
- const searchRegex = new RegExp(search.trim(), 'i');
+ const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
```

---

### MEM-01: In-Memory Deduplication Locks Ineffective on Vercel Serverless

- **Severity:** 🟡 **Medium** (Concurrency Limitation / Stale State)
- **Files:**
  - [`backend/src/controllers/invoiceController.js#L20-L21`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/controllers/invoiceController.js#L20-L21) (`inFlightConsolidatedEmailLocks`, `inFlightSingleEmailLocks`)
  - [`backend/src/controllers/communicationsController.js#L16`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/controllers/communicationsController.js#L16) (`inFlightReplies`)

#### Root Cause
The codebase relies on in-memory JavaScript `Set` and `Map` collections to deduplicate email dispatch and replies:
```javascript
const inFlightConsolidatedEmailLocks = new Set();
const inFlightReplies = new Map();
```
In serverless environments like Vercel:
1. Different incoming HTTP requests execute in separate isolated serverless worker instances. Memory is not shared across instances.
2. In `communicationsController.js`, `setTimeout(() => inFlightReplies.delete(lockKey), 15000)` is used to release locks. When a serverless function completes, Vercel freezes execution immediately. Timers do not fire until the instance thaws later, leaving stale locks in memory.

#### Remediation
For true idempotency in serverless architectures, use atomic database updates with a short expiration timestamp or unique index constraint on `InvoiceEmailLog` and reply schemas.

---

### MEM-02: Linear Heap Memory Explosion on Trash Multi-Collection Pagination

- **Severity:** 🟡 **Medium** (Memory Exhaustion on Large Datasets)
- **File:** [`backend/src/controllers/trashController.js#L89-L110`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/controllers/trashController.js#L89-L110)

#### Root Cause
When viewing the Trash view across all collections (`type === 'All'`), the controller executes:
```javascript
const fetchLimit = skip + parsedLimit;

const promises = types.map(async t => {
    ...
    const items = await config.model.find(filter).sort({ updatedAt: -1 }).limit(fetchLimit).lean();
    return { type: t, items, labelField: config.labelField, count: ... };
});
const results = await Promise.all(promises);
let allItems = [];
results.forEach(res => {
    allItems = [...allItems, ...formatTrash(res.items, res.type, res.labelField)];
});
allItems.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
trash = allItems.slice(skip, skip + parsedLimit);
```

#### Operational Impact
On higher pagination pages (e.g. `page = 100`, `skip = 1500`), it fetches `1500 + 15 = 1515` documents from **each of the 11 models**, allocating over 16,600 Mongoose objects into Node.js heap memory, followed by an in-memory `.sort()`. Under multi-user load, this causes memory pressure and high response latency.

#### Remediation
Implement a cap on `fetchLimit` (e.g. `Math.min(skip + parsedLimit, 100)`), or prompt administrators to filter by specific entity type (`Customer`, `Vehicle`, `Invoice`) for deep historical pagination.

---

### BUG-03: Broken Query Filter for `associatedVehicles` on Customers Endpoint

- **Severity:** 🟡 **Medium** (Non-Functional Filter)
- **File:** [`backend/src/controllers/customerController.js#L68-L72`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/backend/src/controllers/customerController.js#L68-L72)

#### Root Cause
```javascript
if (hasVehicles === 'true') {
    filter.associatedVehicles = { $exists: true, $not: { $size: 0 } };
} else if (hasVehicles === 'false') {
    filter.associatedVehicles = { $size: 0 };
}
```
`Customer` documents do not contain an `associatedVehicles` field.

#### Operational Impact
Attempting to filter customers who own vehicles returns 0 records.

#### Remediation
Resolve customer IDs with active vehicles using a subquery:
```javascript
if (hasVehicles === 'true' || hasVehicles === 'false') {
    const customersWithVehicles = await Vehicle.find({ isActive: true }).distinct('customerId');
    if (hasVehicles === 'true') {
        filter._id = { $in: customersWithVehicles };
    } else {
        filter._id = { $nin: customersWithVehicles };
    }
}
```

---

### BUG-04: Monkey-Patched `window.fetch` Forces Hard Page Reload on 401

- **Severity:** 🟡 **Medium** (Client Architecture & UX Flaw)
- **File:** [`frontend/src/context/AuthContext.jsx#L13-L27`](file:///C:/01.%20frontend/frontend%20domination/Chrysolite/GSK-Automotive/frontend/src/context/AuthContext.jsx#L13-L27)

#### Root Cause
```javascript
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response.status === 401) {
        if (window.location.pathname !== '/login') {
            localStorage.removeItem('gsk_token');
            window.location.href = '/login'; // Hard browser redirect
        }
    }
    return response;
};
```

#### Operational Impact
Globally overriding `window.fetch` intercepts every network request in the application. Any 401 (including harmless verification checks or login credential rejection) forces a hard browser redirect via `window.location.href`, discarding in-memory component states, canceling pending promises, and conflicting with React Router navigation.

#### Remediation
Remove global `window.fetch` monkey-patching. Handle 401 responses using Axios response interceptors or dedicated API client wrappers that utilize React Router's `navigate('/login')`.

---

### DEAD-01: Unmounted Legacy Routes & Controllers

- **Severity:** 🟢 **Low** (Dead Code / Technical Debt)
- **Files:**
  1. `backend/src/routes/saleRoutes.js` and `backend/src/controllers/saleController.js` (Superseded by `dailySalesRoutes.js` / `dailySalesController.js`).
  2. `backend/src/routes/importTrackerRoutes.js`, `backend/src/controllers/importTrackerController.js`, and `backend/src/models/ImportTracker.js` (Superseded by `vehicleBatchRoutes.js` / `vehicleBatchController.js`).
  3. `backend/src/controllers/inventoryController_snippet.js` (Duplicate scratch file).
  4. `backend/src/controllers/helper_add.js` (Duplicate of `bulkAddRegisteredVehiclesToBatch`).
  5. `backend/src/controllers/importControllerHelper.js` (Orphaned file).
  6. `backend/src/controllers/vehicleBatchController.patch` (Orphaned diff file).

#### Operational Impact
Increases cognitive overhead, confuses developers, and creates ambiguity during code maintenance.

#### Remediation
Safely delete these orphaned files from the repository.

---

### DEAD-02: 50+ Stray Test Scripts, Patch Files & Debug Dumps

- **Severity:** 🟢 **Low** (Repository Hygiene & Noise)
- **Root Directory (19 files):**
  - `applyPageAccess.js`
  - `check-pdf.mjs`
  - `check-user-code.js`
  - `check-user-screen.js`
  - `check_case.js`
  - `check_deps.js`
  - `check_indexes.js`
  - `cloudinary_user_error.png`
  - `commit_modules.sh`
  - `debug-delete.js`
  - `e2e-docs-test.js`
  - `e2e-docs-test.mjs`
  - `get-admin.mjs`
  - `query-doc.mjs`
  - `reload-user.js`
  - `test-auth.js`
  - `test-delete-click.js`
  - `test-delete-ui.js`
  - `test_e2e.js`
  - `VEHICLE-DOC-TEST-2026.pdf`
  - `temp-test/`
- **Backend Directory (31 files):**
  - `patch_controller.py`, `patch_controller_car_types.py`, `patch_getBatchVehicles.js`, `patch_test.js`
  - `test-500.cjs`, `test-invoices.cjs`, `test-invoices.js`, `test-manual-invoice.js`, `test.js`
  - `run-smoke-tests.js`, `run-smoke-tests-2.js`
  - `identify_deleted_jcs.js`, `restore_jcs.js`
  - `dummy.jpg`, `login.json`, `create.json`, `filter_audit.json`

#### Remediation
Move legitimate smoke/integration tests into a dedicated `/tests` directory and remove scratch debug files.
