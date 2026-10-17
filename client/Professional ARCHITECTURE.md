# Mollari — Client Architecture Guide

> **Next.js 16 · React 19 · TypeScript · TanStack Query · Tailwind CSS 4**

This document is the single source of truth for the client application's module-based architecture. Read before adding any file.

---

## Table of Contents

- [Three-Layer Architecture](#three-layer-architecture)
- [Directory Structure](#directory-structure)
- [Layer Rules](#layer-rules)
- [Module Internal Structure](#module-internal-structure)
- [Import Rules](#import-rules)
- [What to Delete & Why](#what-to-delete--why)
- [Migration Steps](#migration-steps)
- [Adding a New Module](#adding-a-new-module)
- [Quick Reference](#quick-reference)

---

## Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│           app/  (routing shell)         │
│   pages import from modules, no logic   │
├─────────────────────────────────────────┤
│         modules/  (business layer)      │
│  one folder per domain, self-contained  │
├─────────────────────────────────────────┤
│        shared/  (generic utilities)     │
│    types, utils, components, lib        │
└─────────────────────────────────────────┘
```

| Layer | Responsibility | Can import from |
|---|---|---|
| `app/` | Route definitions, layouts | `modules/`, `shared/` |
| `modules/` | All business domain logic | `shared/` only |
| `shared/` | Generic cross-cutting concerns | nothing in `src/` |

---

## Directory Structure

```
src/
├── app/                              # Next.js App Router — routes only
│   ├── layout.tsx                    # Root layout + providers
│   ├── page.tsx                      # Home → renders modules/homepage
│   ├── globals.css
│   ├── (auth)/                       # Public Authentication routes
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── redirect/
│   │       └── page.tsx              # Post-login session router
│   ├── (public)/                     # Storefront public views
│   │   ├── layout.tsx
│   │   ├── shop/
│   │   │   └── page.tsx
│   │   ├── categories/
│   │   │   ├── page.tsx              # All categories overview
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # Filtered by category
│   │   ├── product/[slug]/
│   │   │   └── page.tsx              # Detail view
│   │   └── support/                  # FAQ, Contact, Shipping Policy
│   │       ├── faq/
│   │       │   └── page.tsx
│   │       └── ...
│   ├── (dashboard)/                  # User & Admin dashboards
│   │   ├── layout.tsx                # Session guard & sidebar skeleton
│   │   ├── dashboard/
│   │   │   ├── page.tsx              # /dashboard (Customer Home OR Staff Hub redirect)
│   │   │   └── [section]/
│   │   │       └── page.tsx          # Admin sections (inventory, orders, customers, etc.)
│   │   └── ...
│   └── api/
│       └── auth/                     # NextAuth configurations
│
├── modules/                          # ALL business domain modules
│   ├── products/                     # Products & Shop catalog
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── components/
│   │   │   ├── ProductDetailView.tsx
│   │   │   └── ShopView.tsx
│   │   └── index.ts
│   ├── orders/                       # Customer and Admin Orders
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── components/
│   │   │   └── OrdersTable.tsx
│   │   └── index.ts
│   ├── cart/                         # Cart and Checkout
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── components/
│   │   │   ├── CartDrawer.tsx
│   │   │   ├── CheckoutView.tsx
│   │   │   └── ProductCheckoutView.tsx
│   │   └── index.ts
│   ├── customers/                    # Admin Customers View
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── components/
│   │   │   └── CustomersTable.tsx
│   │   └── index.ts
│   ├── categories/                   # Category collections
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── components/
│   │   │   └── CategoriesView.tsx
│   │   └── index.ts
│   ├── inventory/                    # Stock and Adjustments
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── components/
│   │   │   ├── InventoryTable.tsx
│   │   │   └── StockAdjustmentModal.tsx
│   │   └── index.ts
│   ├── analytics/                    # Dashboard metrics
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   └── index.ts
│   ├── auth/                         # User Session, Auth State
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── components/
│   │   │   └── RegisterView.tsx
│   │   └── index.ts
│   ├── homepage/                     # Storefront landing page
│   │   ├── components/
│   │   │   ├── Features.tsx
│   │   │   ├── FeaturedProducts.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── LanguageToggle.tsx
│   │   │   └── Newsletter.tsx
│   │   ├── locales/
│   │   │   ├── HomepageLocaleContext.tsx
│   │   │   └── types.ts
│   │   └── index.ts
│   ├── dashboard/                    # Core Admin Hub
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── DashboardPageView.tsx
│   │   │   ├── ManualSaleModal.tsx
│   │   │   ├── Primitives.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── settings/             # StaffFormView, etc.
│   │   │   └── views/                # Subviews for dashboard sections (SalesView, SuppliersView, etc.)
│   │   ├── locales/
│   │   │   └── DashboardLocaleContext.tsx
│   │   └── index.ts
│   ├── customer-dashboard/           # Consolidated User Dashboard
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── tokens.ts
│   │   ├── types.ts
│   │   ├── components/
│   │   │   ├── CustomerDashboardView.tsx
│   │   │   ├── WishlistDrawer.tsx
│   │   │   ├── shared.tsx
│   │   │   └── tabs/                 # Subviews (OverviewTab, OrdersTab, ProfileTab, etc.)
│   │   └── index.ts
│   │
│   │   # Pure Business Data Modules (Consumed by dashboard orchestration)
│   ├── branches/                     # Branches domain (api.ts, queries.ts, mutations.ts, index.ts)
│   ├── suppliers/                    # Suppliers domain (api.ts, queries.ts, mutations.ts, index.ts)
│   ├── promotions/                   # Promotions domain (api.ts, queries.ts, mutations.ts, index.ts)
│   ├── manual-sales/                 # Manual sales domain (api.ts, queries.ts, mutations.ts, index.ts)
│   ├── manual-returns/               # Manual returns domain (api.ts, queries.ts, mutations.ts, index.ts)
│   └── payment-methods/              # Custom payment methods (api.ts, queries.ts, mutations.ts, index.ts)
│
├── shared/                           # Generic, domain-agnostic
│   ├── lib/
│   │   └── apiClient.ts
│   ├── types/
│   │   ├── product.ts
│   │   ├── order.ts
│   │   ├── customer.ts
│   │   ├── payment.ts
│   │   ├── inventory.ts
│   │   ├── common.ts
│   │   └── index.ts
│   ├── constants/
│   │   ├── config.ts
│   │   ├── patterns.ts
│   │   ├── enums.ts
│   │   ├── roles.ts                  # User roles and access control constants
│   │   └── index.ts
│   ├── contexts/                     # Application-wide React Contexts
│   │   ├── CartContext.tsx
│   │   ├── WishlistContext.tsx
│   │   └── index.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── string.ts
│   │   ├── storage.ts
│   │   ├── helpers.ts
│   │   ├── errors.ts
│   │   └── index.ts
│   ├── components/
│   │   ├── CategoryCard.tsx          # Shared collections/categories card
│   │   ├── ProductCard.tsx           # Shared storefront product card
│   │   ├── ErrorBoundary.tsx
│   │   ├── Skeletons.tsx
│   │   ├── LoadingStates.tsx
│   │   └── index.ts
│   └── providers/
│       ├── QueryProvider.tsx
│       └── index.ts
│
└── test/
    ├── test-utils.tsx
    └── utils.test.ts
```

---

## Layer Rules

### `app/` — Routing Shell Only

Pages are thin. They import from `modules/` and render. Zero business logic lives inside a page file.

```tsx
// ✅ app/(public)/shop/page.tsx
import { ShopView } from '@/modules/products'

export default function ShopPage() {
  return <ShopView />
}

// ❌ Never — business logic inside a page
export default function ShopPage() {
  const [products, setProducts] = useState([])
  useEffect(() => { fetch('/api/products').then(...) }, [])
  return <div>{products.map(...)}</div>
}
```

#### Shared Dashboard Routing Strategy (`src/app/(dashboard)/dashboard/page.tsx`)
Rather than separating dashboards into distinct layouts/routes, `/dashboard` is role-guarded. If a Customer lands on this page, they are rendered the consolidated `<CustomerDashboardView />`. If a Staff member lands here, they are shown the `<DashboardPageView />` (the admin hub overview):

```tsx
// ✅ Roles-guarded page router in app/(dashboard)/dashboard/page.tsx
import { auth, getRoleFromAccessToken } from '@/auth';
import { isCustomerRole, isStaffRole } from '@/shared/constants';
import { CustomerDashboardView } from '@/modules/customer-dashboard';
import { DashboardLocaleProvider, DashboardPageView } from '@/modules/dashboard';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');
  
  const role = getRoleFromAccessToken(session.accessToken);
  if (isCustomerRole(role)) {
    return <CustomerDashboardView />;
  }
  if (isStaffRole(role)) {
    return (
      <DashboardLocaleProvider>
        <DashboardPageView />
      </DashboardLocaleProvider>
    );
  }
  redirect('/');
}
```

---

### `modules/` — Business Domain Layer

Every domain lives here as a self-contained module. A module owns its API calls, React Query hooks, mutations, and UI components. Nothing leaks out except through `index.ts`.

```ts
// ✅ Consuming a module — only the barrel
import { ShopView, useProducts } from '@/modules/products'

// ❌ Reaching into module internals — forbidden
import { productAPI }  from '@/modules/products/api'
import { PRODUCT_KEYS } from '@/modules/products/queries'
```

Modules must not import from each other. If two modules share a concern, it belongs in `shared/`.

```ts
// ❌ Cross-module import — forbidden
// inside modules/orders/api.ts
import { useProducts } from '@/modules/products'
```

---

### `shared/` — Generic Utilities

`shared/` has zero domain knowledge. The test: if deleting a module requires changing a file in `shared/`, something is wrong.

```ts
// ✅ shared/utils/formatters.ts — generic, no domain knowledge
export const formatPrice = (amount: number) => `৳${amount.toLocaleString('en-BD')}`

// ❌ This is domain logic — belongs in modules/orders, not shared/
export const calculateOrderTotal = (items: OrderItem[]) => ...
```

---

## Module Internal Structure

Every module follows this exact layout:

```
modules/<domain>/
├── api.ts          # Raw HTTP calls only — no React, no hooks
├── queries.ts      # useQuery hooks + hierarchical query keys
├── mutations.ts    # useMutation hooks with cache invalidation
├── components/     # UI components scoped to this domain
│   └── *.tsx
└── index.ts        # Public barrel — the ONLY import surface
```

### Pure Business Data Modules
Modules with no dedicated UI components (such as `branches/`, `suppliers/`, `manual-sales/`, `manual-returns/`, `promotions/`, `payment-methods/`) omit the `components/` directory. Their APIs and React Query hooks are imported and consumed by views in the consolidated `dashboard` orchestrator view layer (`modules/dashboard/components/views/*`). This separates UI layout logic from domain logic and keeps our visual admin panels centralized.

### api.ts

```ts
// modules/products/api.ts
import apiClient from '@/shared/lib/apiClient'
import type { Product, ListProductsParams } from '@/shared/types'

export const productAPI = {
  list: (params?: ListProductsParams) =>
    apiClient.get<Product[]>('/products', { params }),

  getBySlug: (slug: string) =>
    apiClient.get<Product>(`/products/${slug}`),

  getFeatured: (limit = 8) =>
    apiClient.get<Product[]>('/products', { params: { featured: true, limit } }),

  create: (data: Partial<Product>) =>
    apiClient.post<Product>('/products', data),

  update: (id: number, data: Partial<Product>) =>
    apiClient.put<Product>(`/products/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/products/${id}`),
}
```

### queries.ts

```ts
// modules/products/queries.ts
import { useQuery } from '@tanstack/react-query'
import { productAPI } from './api'
import type { ListProductsParams } from '@/shared/types'

export const PRODUCT_KEYS = {
  all:      ['products']                                        as const,
  lists:    ()           => ['products', 'list']               as const,
  list:     (p: ListProductsParams) => ['products', 'list', p] as const,
  details:  ()           => ['products', 'detail']             as const,
  detail:   (slug: string) => ['products', 'detail', slug]     as const,
  featured: ()           => ['products', 'featured']           as const,
}

export const useProducts = (params?: ListProductsParams) =>
  useQuery({
    queryKey: PRODUCT_KEYS.list(params ?? {}),
    queryFn:  () => productAPI.list(params),
    staleTime: 5 * 60 * 1000,
  })

export const useProductBySlug = (slug: string) =>
  useQuery({
    queryKey: PRODUCT_KEYS.detail(slug),
    queryFn:  () => productAPI.getBySlug(slug),
    enabled:  !!slug,
    staleTime: 10 * 60 * 1000,
  })

export const useFeaturedProducts = (limit = 8) =>
  useQuery({
    queryKey: PRODUCT_KEYS.featured(),
    queryFn:  () => productAPI.getFeatured(limit),
    staleTime: 10 * 60 * 1000,
  })
```

### mutations.ts

```ts
// modules/products/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { productAPI } from './api'
import { PRODUCT_KEYS } from './queries'
import type { Product } from '@/shared/types'

export const useCreateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: productAPI.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() }),
  })
}

export const useUpdateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) =>
      productAPI.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEYS.all }),
  })
}

export const useDeleteProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: productAPI.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() }),
  })
}
```

### index.ts

```ts
// modules/products/index.ts
// Export only what pages and layouts need.
// api.ts internals and query keys stay private.

export { useProducts, useProductBySlug, useFeaturedProducts } from './queries'
export { useCreateProduct, useUpdateProduct, useDeleteProduct } from './mutations'
export { default as ShopView } from './components/ShopView'
export { default as ProductDetailView } from './components/ProductDetailView'
```

---

## Import Rules

```
app/        →  modules/,  shared/
modules/*   →  shared/   only
shared/     →  nothing inside src/
```

```ts
// ✅ In a page
import { ShopView }      from '@/modules/products'
import { ErrorBoundary } from '@/shared/components'
import type { Product }  from '@/shared/types'

// ✅ Inside a module
import apiClient         from '@/shared/lib/apiClient'
import { formatPrice }   from '@/shared/utils'
import type { Product }  from '@/shared/types'

// ❌ Module importing another module
import { useCart } from '@/modules/cart'        // inside modules/products — forbidden

// ❌ shared/ importing a module
import { productAPI } from '@/modules/products' // inside shared/ — forbidden

// ❌ Bypassing the barrel
import { productAPI } from '@/modules/products/api' // always use index.ts
```

---

## What to Delete & Why

### `features/` → merge into `modules/`, then delete
`features/` duplicated what `modules/` owned. All former features have been merged into `modules/`, and the legacy directory has been completely deleted. **Do not reintroduce this directory.**

### `entities/` → update all imports, then delete
`entities/` only re-exported from `shared/types/`. It doubled the typing surface area for no utility. All imports have been redirected directly to `shared/types` and `entities/` has been deleted.

### `components/` (root) → redistribute, then delete
Root components were distributed between generic UI in `shared/components/` and domain-specific UI in `modules/<domain>/components/`. The root directory is gone.

---

## Migration Steps

- [x] Merge everything from `features/<domain>/` into `modules/<domain>/`
- [x] Delete `features/` directory
- [x] Replace all `@/entities/*` imports with `@/shared/types`
- [x] Delete `entities/` directory
- [x] Move root `components/` files into `shared/components/` or `modules/<domain>/components/`
- [x] Delete root `components/` directory
- [x] Update `tsconfig.json` path aliases if any pointed to deleted directories
- [x] Run `npm run typecheck` — fix broken imports
- [x] Run `npm run lint` — fix path violations

---

## Adding a New Module

```bash
# 1. Create the skeleton
mkdir -p src/modules/payments/components
touch src/modules/payments/{api,queries,mutations,index}.ts

# 2. Define types in shared/types/ first — never in the module itself

# 3. Implement in order: api.ts → queries.ts → mutations.ts → components/ → index.ts

# 4. Wire into app/ via the barrel only — never import internals
```

Build the module first, then wire it into `app/`. Never start from the page and work inward.

---

## Quick Reference

| What | Where |
|---|---|
| New page / route | `app/<route-group>/<route>/page.tsx` |
| Auth guard / shared chrome | `app/<route-group>/layout.tsx` |
| HTTP calls for a domain | `modules/<domain>/api.ts` |
| React Query hooks | `modules/<domain>/queries.ts` |
| Create / Update / Delete | `modules/<domain>/mutations.ts` |
| Domain UI components | `modules/<domain>/components/` |
| Generic UI (CategoryCard, ProductCard) | `shared/components/` |
| Application Contexts (Cart, Wishlist) | `shared/contexts/` |
| TypeScript types & enums | `shared/types/<domain>.ts` |
| Formatting / utility functions | `shared/utils/` |
| Env config, API base URL | `shared/constants/config.ts` |
| QueryClient provider | `shared/providers/QueryProvider.tsx` |
| Test helpers | `test/test-utils.tsx` |

---

*Last updated: May 20, 2026*
