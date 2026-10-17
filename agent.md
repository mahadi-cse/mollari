# Mollari — Agent Reference (`agent.md`)

> **Purpose**: Complete project knowledge base. Read this before making any changes to avoid redundant exploration.

---

## 1. Business Context

**Mollari** is a Bangladeshi cosmetics e-commerce & POS platform. It serves:
- **Customers**: Online storefront (product browsing, cart, checkout, order tracking, wishlisting).
- **Staff/Admin**: Dashboard for inventory, POS manual sales, order processing, analytics, settings.

**Key regional conventions**:
- Currency: Bangladeshi Taka (`৳`), formatted as `` `৳${amount.toLocaleString('en-BD')}` `` — see `formatCurrency()` in `theme.ts`.
- Languages: English (`en`) and Bengali (`bn`), switchable in the dashboard.
- Payment gateway: **SSLCommerz** (online), **Cash/COD** (in-store).

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19 |
| Styling | Tailwind CSS + custom `Theme` design tokens |
| Data Fetching | Axios (`apiClient`) + TanStack React Query |
| Auth | NextAuth.js (JWT strategy, Google OAuth) |
| Backend | Express.js + TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL (Supabase hosted) |
| Caching | In-memory (dev) / Upstash Redis (prod) |
| File Uploads | Cloudinary |
| Payments | SSLCommerz |

---

## 3. Ports & URLs

| Service | URL |
|---|---|
| Next.js frontend | `http://localhost:3000` |
| Express backend | `http://localhost:4000` |
| API base prefix | `http://localhost:4000/api` |
| Prisma Studio | `npx prisma studio` (browser) |

---

## 4. Full Directory Structure

```
f:\My Projects\mollari\
├── agent.md                        ← This file
├── README.md
├── server.bat                      ← Windows script to start server
│
├── client/                         ← Next.js Frontend
│   ├── .env.local                  ← NEXT_PUBLIC_API_URL, NEXTAUTH_SECRET, etc.
│   ├── next.config.ts
│   ├── src/
│   │   ├── auth.ts                 ← NextAuth config (JWT, Google)
│   │   ├── proxy.ts                ← Next.js middleware (route protection)
│   │   ├── app/
│   │   │   ├── layout.tsx          ← Root layout (providers)
│   │   │   ├── globals.css
│   │   │   ├── (auth)/             ← Auth route group
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── redirect/
│   │   │   ├── (public)/           ← Public storefront route group
│   │   │   │   ├── page.tsx        ← Homepage
│   │   │   │   ├── shop/
│   │   │   │   ├── product/[slug]/
│   │   │   │   ├── products/
│   │   │   │   ├── categories/
│   │   │   │   ├── categories/[slug]/
│   │   │   │   ├── cart/
│   │   │   │   ├── checkout/       ← SSLCommerz + COD checkout
│   │   │   │   └── support/        ← contact, faq, shipping-policy
│   │   │   ├── (dashboard)/        ← Protected admin/staff route group
│   │   │   │   └── dashboard/
│   │   │   │       ├── page.tsx    ← Root dashboard redirect
│   │   │   │       └── [section]/  ← Section-based routing
│   │   │   └── api/
│   │   │       └── auth/[...nextauth]/ ← NextAuth API route
│   │   │
│   │   ├── modules/                ← Domain-driven feature modules
│   │   │   ├── analytics/
│   │   │   ├── auth/               ← Auth hooks (useSecurityDevices, etc.)
│   │   │   ├── branches/
│   │   │   ├── cart/               ← CartContext, CheckoutView
│   │   │   ├── categories/
│   │   │   ├── coupons/
│   │   │   ├── customer-dashboard/ ← Customer-facing dashboard
│   │   │   ├── customers/
│   │   │   ├── dashboard/          ← Admin dashboard module (main)
│   │   │   │   ├── index.ts        ← Public exports
│   │   │   │   ├── locales/
│   │   │   │   │   ├── en.ts       ← English translations
│   │   │   │   │   ├── bn.ts       ← Bengali translations
│   │   │   │   │   ├── DashboardLocaleContext.tsx
│   │   │   │   │   └── types.ts
│   │   │   │   ├── utils/
│   │   │   │   │   ├── theme.ts    ← Design tokens + formatCurrency
│   │   │   │   │   └── constants.ts ← NAV, SETTINGS_ITEMS arrays
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useResponsive.ts
│   │   │   │   │   └── useBreakpoint.ts
│   │   │   │   └── components/
│   │   │   │       ├── DashboardLayout.tsx  ← Main layout shell (sidebar, topbar)
│   │   │   │       ├── DashboardPageView.tsx
│   │   │   │       ├── Primitives.tsx       ← Card, Btn, Badge, SecHead, KpiCard
│   │   │   │       ├── Table.tsx            ← Th, Td
│   │   │   │       ├── ManualSaleModal.tsx
│   │   │   │       ├── BulkUploadModal.tsx
│   │   │   │       ├── BarcodeScannerModal.tsx
│   │   │   │       ├── settings/
│   │   │   │       │   ├── AuditLogsSettingsTab.tsx
│   │   │   │       │   ├── CustomerSettingsView.tsx
│   │   │   │       │   ├── DiscountsSettingsTab.tsx  ← Promotions + Coupons (side-by-side tabs)
│   │   │   │       │   ├── GeneralSettingsTab.tsx
│   │   │   │       │   ├── InventorySettingsTab.tsx
│   │   │   │       │   ├── NotificationSettingsTab.tsx
│   │   │   │       │   ├── PaymentSettingsTab.tsx
│   │   │   │       │   ├── SecuritySettingsTab.tsx  ← Active sessions / device management
│   │   │   │       │   ├── ShippingSettingsTab.tsx
│   │   │   │       │   ├── StaffFormView.tsx
│   │   │   │       │   └── TrendingSettingsTab.tsx
│   │   │   │       └── views/
│   │   │   │           ├── AnalyticsView.tsx   ← Charts + PDF/CSV/Excel export
│   │   │   │           ├── BranchesView.tsx
│   │   │   │           ├── CategoriesView.tsx
│   │   │   │           ├── EcommerceView.tsx   ← Orders management
│   │   │   │           ├── InventoryView.tsx
│   │   │   │           ├── OverviewView.tsx
│   │   │   │           ├── ProductsView.tsx
│   │   │   │           ├── ProfileView.tsx
│   │   │   │           ├── ReturnsView.tsx
│   │   │   │           ├── SalesView.tsx       ← Manual sales + POS
│   │   │   │           ├── SettingsView.tsx    ← Root settings orchestrator
│   │   │   │           └── SuppliersView.tsx
│   │   │   ├── homepage/           ← Homepage API, hero slider, stats
│   │   │   ├── inventory/
│   │   │   ├── manual-returns/
│   │   │   ├── manual-sales/
│   │   │   ├── orders/
│   │   │   ├── payment-methods/
│   │   │   ├── products/
│   │   │   ├── promotions/
│   │   │   ├── reviews/
│   │   │   └── suppliers/
│   │   │
│   │   └── shared/
│   │       ├── lib/
│   │       │   ├── apiClient.ts     ← Axios instance (baseURL = /api, withCredentials)
│   │       │   └── confirmDialog.ts
│   │       ├── constants/
│   │       │   ├── config.ts        ← API_CONFIG, ROUTES, PAGINATION, PAYMENT constants
│   │       │   ├── roles.ts         ← USER_TYPE_CODES, STAFF_ROLE_CODES, isStaffRole()
│   │       │   ├── enums.ts
│   │       │   └── patterns.ts
│   │       ├── contexts/
│   │       │   ├── CartContext.tsx
│   │       │   └── WishlistContext.tsx
│   │       ├── utils/
│   │       │   ├── exportUtils.ts   ← PDF/CSV/Excel export helpers
│   │       │   ├── formatters.ts
│   │       │   ├── errors.ts
│   │       │   ├── helpers.ts
│   │       │   ├── storage.ts
│   │       │   ├── string.ts
│   │       │   ├── theme.ts         ← Shared (non-dashboard) theme util
│   │       │   └── imageOptimizer.ts
│   │       ├── components/
│   │       ├── types/
│   │       └── providers/
│
└── server/                          ← Express Backend
    ├── .env                         ← All backend secrets (see section 7)
    ├── prisma/
    │   ├── schema.prisma            ← Full DB schema (1265 lines)
    │   ├── seed.ts                  ← Main seed
    │   ├── seed-auth-admin.ts       ← Creates SYSTEM_ADMIN user
    │   ├── seed-rbac.ts             ← RBAC roles & permissions
    │   ├── seed-dashboard.ts
    │   └── seed-customer-dashboard.ts
    └── src/
        ├── index.ts                 ← Server entrypoint
        ├── app.ts                   ← Express app + all route mounts
        ├── vercel.ts                ← Vercel serverless adapter
        ├── config/
        │   ├── database.ts          ← PrismaClient singleton
        │   ├── env.ts               ← Zod-validated env schema
        │   ├── redis.ts             ← Upstash Redis client
        │   ├── cloudinary.ts
        │   ├── sslcommerz.ts
        │   └── keycloak.ts
        ├── middleware/
        │   ├── authenticate.ts      ← JWT auth + role guards
        │   ├── errorHandler.ts
        │   ├── notFound.ts
        │   ├── rateLimiter.ts       ← generalLimiter + authLimiter
        │   ├── requestLogger.ts
        │   └── validate.ts          ← Zod request validation
        ├── shared/
        │   ├── types/
        │   │   ├── auth.types.ts    ← USER_TYPE_CODES, AuthUser
        │   │   └── express.d.ts     ← req.user type augmentation
        │   └── utils/
        │       ├── auditLogger.ts   ← AuditLogger.log() helper
        │       ├── cache.ts         ← cacheGet/cacheSet/cacheDel/TTL
        │       ├── pagination.ts    ← parsePagination()
        │       ├── AppError.ts      ← Custom error class
        │       ├── apiResponse.ts   ← success/error response builders
        │       ├── asyncHandler.ts  ← try/catch wrapper
        │       ├── logger.ts        ← Winston logger
        │       ├── slug.ts          ← generateSlug()
        │       └── userAgent.ts     ← Parse device/browser from UA string
        └── modules/
            ├── analytics/
            ├── audit-logs/          ← auditLog.router.ts (GET /api/audit-logs)
            ├── auth/                ← auth.router.ts, auth.controller.ts, auth.service.ts
            ├── branches/
            ├── categories/
            ├── coupons/
            ├── customer-dashboard/
            ├── customers/
            ├── homepage/            ← routes.ts (stats, settings, slider, state, promotions)
            ├── inventory/
            ├── manual-returns/
            ├── manual-sales/
            ├── orders/
            ├── payment-methods/
            ├── products/
            ├── promotions/
            ├── reviews/
            ├── suppliers/
            └── uploads/
```

---

## 5. All API Routes (server → app.ts mounts)

| Mount Prefix | Module File | Notes |
|---|---|---|
| `GET /health` | app.ts inline | Public health check |
| `/api/auth` | `auth/auth.router.ts` | Login, register, refresh, logout, profile, users, security-devices |
| `/api/products` | `products/product.router.ts` | Public GET; Protected POST/PUT/PATCH/DELETE |
| `/api/categories` | `categories/category.router.ts` | Public GET; Protected mutations |
| `/api/inventory` | `inventory/inventory.router.ts` | Staff only |
| `/api/orders` | `orders/order.router.ts` | Customer COD + Staff order management |
| `/api/customers` | `customers/customer.router.ts` | Staff + admin |
| `/api/analytics` | `analytics/analytics.router.ts` | Staff only |
| `/api/homepage` | `homepage/routes.ts` | Public stats/settings/slider/state; Admin settings mutations |
| `/api/audit-logs` | `audit-logs/auditLog.router.ts` | SYSTEM_ADMIN + MANAGER only |
| `/api/manual-sales` | `manual-sales/manualSale.router.ts` | Staff only |
| `/api/manual-returns` | `manual-returns/manualReturn.router.ts` | Staff only |
| `/api/suppliers` | `suppliers/supplier.router.ts` | Staff only |
| `/api/branches` | `branches/branch.router.ts` | Admin only |
| `/api/customer-dashboard` | `customer-dashboard/customerDashboard.router.ts` | Customer only |
| `/api/promotions` | `promotions/promotion.router.ts` | Public active; Admin CRUD |
| `/api/coupons` | `coupons/coupon.router.ts` | Public validate; Admin CRUD |
| `/api/uploads` | `uploads/upload.router.ts` | Staff + customer (Cloudinary) |
| `/api/reviews` | `reviews/review.router.ts` | Customer only |

### Key Auth Routes
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/google
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/profile
PATCH /api/auth/profile
POST /api/auth/change-password
GET  /api/auth/users                   ← SYSTEM_ADMIN only
POST /api/auth/users                   ← SYSTEM_ADMIN only
PATCH /api/auth/users/:id
GET  /api/auth/security-devices
POST /api/auth/security-devices/:id/revoke
POST /api/auth/security-devices/revoke-all-others
```

---

## 6. Role & Permission System

### User Type Codes (same values in both client & server)
```typescript
USER_TYPE_CODES = {
  SYSTEM_ADMIN: '1x101',
  MANAGER:      '4x404',
  SALES_STAFF:  '5x505',
  CASHIER:      '6x606',
  RIDER:        '7x707',
  CUSTOMER:     '9x909',
}
```

### Middleware Functions (server)
- `authenticate` — verifies JWT access token from `Authorization: Bearer` header.
- `authorize(...roles)` — restricts route to listed role codes.
- `authMiddleware` / `allowRoles()` — aliases used in auth.router.ts.

### Client Guards (proxy.ts / Next.js middleware)
- `/dashboard/*` — requires `isStaffRole()` or `isCustomerRole()`.
- `/cart/*`, `/checkout/*` — requires any authenticated user.

---

## 7. Environment Variables

### Server (`server/.env`)
```
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000
DATABASE_URL=postgresql://...         ← Supabase PostgreSQL
ACCESS_TOKEN_SECRET=...
ACCESS_TOKEN_EXPIRES_HOURS=3
REFRESH_TOKEN_EXPIRES_DAYS=7
REFRESH_TOKEN_COOKIE_NAME=mollari_refresh_token
GOOGLE_CLIENT_ID=...
SSLCOMMERZ_STORE_ID=...
SSLCOMMERZ_STORE_PASSWD=...
SSLCOMMERZ_IS_LIVE=false
SSLCOMMERZ_SUCCESS_URL=http://localhost:4000/api/payments/sslcommerz/success
SSLCOMMERZ_FAIL_URL=...
SSLCOMMERZ_CANCEL_URL=...
SSLCOMMERZ_IPN_URL=...
CLOUDINARY_CLOUD_NAME=dtahw4wgw
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
REDIS_URL=redis://localhost:6379
BCRYPT_ROUNDS=12
LOG_LEVEL=debug
TZ=Asia/Dhaka
```

### Client (`client/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## 8. Critical Coding Patterns & Rules

### 8.1. apiClient Path Rule (MOST COMMON BUG)
`apiClient` has `baseURL = http://localhost:4000/api`. Do NOT prefix paths with `/api`.
```typescript
// ✅ CORRECT
apiClient.get('/products')           → calls http://localhost:4000/api/products
apiClient.get('/audit-logs')         → calls http://localhost:4000/api/audit-logs

// ❌ WRONG — results in 404 (/api/api/...)
apiClient.get('/api/products')
apiClient.get('/api/homepage/audit-logs')
```

### 8.2. Audit Logging
Call `AuditLogger.log()` in every controller mutation (CREATE / UPDATE / DELETE / TOGGLE).
```typescript
import { AuditLogger } from '../../shared/utils/auditLogger';

await AuditLogger.log({
  req,                          // Express Request (for IP + User-Agent)
  userId: req.user.id,          // Operator ID
  action: 'CREATE',             // 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE'
  entity: 'Product',            // Prisma model name string
  entityId: String(product.id),
  entityLabel: product.name,    // Human-readable identifier
  before: null,                 // State before (null for CREATE)
  after: product,               // State after (null for DELETE)
  orderId: null,                // Only for Order-related logs
});
```

**Audited entities so far**: `Product`, `Category`, `ManualSale`, `Order`, `SiteSettings`, `HomepageStats`, `HeroSlider`, `Coupon`, `Promotion`, `PaymentMethodOption`.

### 8.3. Caching Pattern (server)
```typescript
import { cacheGet, cacheSet, cacheDel, TTL } from '../../shared/utils/cache';

// Read
const cached = await cacheGet<MyType>('cache-key');
if (cached) return res.json(cached);

// Write
await cacheSet('cache-key', result, TTL.MEDIUM); // 10 min

// Invalidate
await cacheDel('cache-key');
```

TTL constants: `SHORT` (5min), `MEDIUM` (10min), `LONG` (15min), `VERY_LONG` (60min).

### 8.4. Localization (client)
All dashboard UI strings live in two files — **always add to both** when introducing new strings:
- `client/src/modules/dashboard/locales/en.ts`
- `client/src/modules/dashboard/locales/bn.ts`

Access in components via `useDashboardLocale()` hook:
```tsx
import { useDashboardLocale } from '../../locales/DashboardLocaleContext';
const { t } = useDashboardLocale();
// t.securityDevices.currentDevice → "This Device" or "আপনার বর্তমান ডিভাইস"
```

### 8.5. Design Tokens (client)
Use `Theme` object for inline styles, never hardcode colors:
```tsx
import { Theme } from '@/modules/dashboard/utils/theme';

<div style={{ color: Theme.fg, background: Theme.card, border: `1px solid ${Theme.border}` }}>
```

Token map:
```
Theme.primary     = #f01172  (pink/brand)
Theme.primaryDark = #c20d5e
Theme.bg          = #f5f5f5
Theme.fg          = #212121
Theme.card        = #ffffff
Theme.muted       = #f5f5f5
Theme.mutedFg     = #757575
Theme.border      = #e0e0e0
Theme.secondary   = #fff0f6
Theme.success     = #10b981
Theme.warning     = #f59e0b
Theme.danger      = #ef4444
```

### 8.6. Primitive Components
```tsx
import { Card, Btn, Badge, SecHead, KpiCard } from '../Primitives';
import { Th, Td } from '../Table';
```

### 8.7. Pagination (server)
```typescript
import { parsePagination } from '../../shared/utils/pagination';
const page = parseInt(req.query.page as string || '1');
const limit = parseInt(req.query.limit as string || '20');
const { skip, take } = parsePagination({ page, limit });
```

---

## 9. Database Schema — Key Models

| Model | Table | Notes |
|---|---|---|
| `User` | `users` | All platform users (staff + customers) |
| `UserType` | `user_type` | Role definitions (SYSTEM_ADMIN, CUSTOMER, etc.) |
| `RefreshToken` | `refresh_tokens` | Hashed JWT refresh tokens, device info |
| `Customer` | `customers` | Extended profile for Customer role users |
| `Product` | `products` | Full product catalog with SKU, sizes, images |
| `ProductSize` | `product_sizes` | Optional size variants per product |
| `Category` | `categories` | Product categories with slug |
| `Inventory` | `inventory` | Stock per product per branch |
| `InventoryTransaction` | `inventory_transactions` | Immutable stock movement log |
| `Order` | `orders` | E-commerce orders (online + COD) |
| `OrderItem` | `order_items` | Line items per order |
| `ManualSale` | `manual_sales` | POS/in-store sales (staff-recorded) |
| `ManualSaleItem` | `manual_sale_items` | Line items per manual sale |
| `ManualReturn` | `manual_returns` | Warehouse returns |
| `AuditLog` | `audit_logs` | Immutable audit trail for all mutations |
| `Branch` | `branches` | Physical store locations/warehouses |
| `Supplier` | `suppliers` | Product suppliers |
| `SupplierTransaction` | `supplier_transactions` | Money/goods exchanged with suppliers |
| `Payment` | `payments` | One payment per order |
| `Coupon` | `coupons` | Discount coupons (FIXED or PERCENTAGE) |
| `Promotion` | `promotions` | Active promotions (ALL / PRODUCT / CATEGORY) |
| `PaymentMethodOption` | `payment_method_options` | Configurable payment methods |
| `HeroSlider` | `hero_slider` | Homepage carousel slides |
| `HomepageStats` | `homepage_stats` | Configurable homepage metrics |
| `SiteSettings` | `site_settings` | Global store config (name, colors, contact) |
| `AppModule` | `app_modules` | Dashboard navigation module registry |
| `UserModule` | `user_modules` | Per-user module access control |
| `SKUSetting` | `sku_settings` | Auto SKU generation rules per category |
| `AuditLog.orderId` | — | Nullable FK to `orders` for order-related logs |

### AuditLog Model
```prisma
model AuditLog {
  id          Int       @id @default(autoincrement())
  userId      Int?
  user        User?     @relation("CreatedBy", ...)
  action      String    // CREATE | UPDATE | DELETE | TOGGLE
  entity      String    // Prisma model name
  entityId    String
  entityLabel String?
  before      Json?
  after       Json?
  ipAddress   String?
  userAgent   String?
  orderId     Int?      // FK to orders (optional)
  createdAt   DateTime  @default(now())
  @@map("audit_logs")
}
```

---

## 10. Dev Commands

### Backend
```bash
# Start dev server (tsx watch)
cd server && npm run dev

# TypeScript compile check (no emit)
cd server && npx tsc

# DB migration
cd server && npm run db:migrate

# Push schema without migration
cd server && npm run db:push

# Seed admin user  (email: admin@mollari.local  pw: Admin@mahadi@cse)
cd server && npm run db:seed:auth-admin

# Seed RBAC roles
cd server && npm run db:seed:rbac

# Open Prisma Studio
cd server && npm run db:studio
```

### Frontend
```bash
# Start dev server
cd client && npm run dev

# TypeScript compile check
cd client && npx tsc

# Production build (also verifies TS)
cd client && npm run build
```

---

## 11. Dashboard Navigation Sections

The dashboard is section-routed via `/dashboard/[section]`. Known sections:

| Section Key | View Component | Description |
|---|---|---|
| `overview` | `OverviewView` | KPIs, recent activity, stock alerts |
| `products` | `ProductsView` | Product CRUD, bulk import |
| `categories` | `CategoriesView` | Category management |
| `ecommerce` | `EcommerceView` | Online order processing |
| `inventory` | `InventoryView` | Stock levels, adjustments, history |
| `sales` | `SalesView` | Manual POS sales + history |
| `analytics` | `AnalyticsView` | Charts + PDF/CSV/Excel reports |
| `returns` | `ReturnsView` | Return management |
| `suppliers` | `SuppliersView` | Supplier + transactions |
| `branches` | `BranchesView` | Branch/warehouse management |
| `settings` | `SettingsView` | All settings tabs |

### Settings Tabs (within SettingsView)
`general` | `payment` | `shipping` | `inventory` | `notifications` | `staff` | `trending` | `discounts` | `security` | `audit`

---

## 12. Known Issues / Gotchas

1. **Double `/api` prefix**: The most common bug. `apiClient.baseURL` already includes `/api`. Never prefix client-side paths with `/api`.
2. **Refresh token stored as cookie**: `mollari_refresh_token` cookie (httpOnly). Access token passed as `Authorization: Bearer` header.
3. **AuditLog `orderId` FK**: The `audit_logs.order_id` column is a FK to `orders`. For non-order audit logs, always pass `orderId: null`.
4. **Cache invalidation**: Homepage routes use Redis/memory cache. After any settings mutation, call `cacheDel(HP_KEYS.xyz)` to invalidate.
5. **Admin credentials (local dev)**: `admin@mollari.local` / `Admin@mahadi@cse` (SYSTEM_ADMIN role).
6. **Supabase connection**: Uses direct (port 5432) not PgBouncer pooler for Prisma compatibility.
7. **Cloudinary uploads**: All images use Cloudinary. Upload endpoint: `POST /api/uploads`.
