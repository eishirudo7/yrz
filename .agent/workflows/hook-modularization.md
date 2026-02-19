---
description: Memecah hooks besar menjadi modular domain-specific hooks
---

# Hook Modularization Workflow

Gunakan workflow ini untuk memecah custom hooks besar menjadi lebih modular.

## Target Hooks
| File | Lines | Domain |
|------|-------|--------|
| `useDashboard.ts` | 627 | Dashboard data, orders, ads |
| `useOrders.ts` | 376 | Order list, escrow sync |
| `useProducts.ts` | 511 | Product list, stock update |

## Steps

// turbo
1. **Analyze Hook Structure**
   ```bash
   # List all functions inside the hook
   grep -n "const\|function\|async" app/hooks/useDashboard.ts | head -30
   ```

2. **Identify Responsibilities**
   
   Untuk setiap hook, list semua responsibilities:
   
   **useDashboard.ts:**
   - Order subscription (realtime)
   - Order processing
   - Ads data fetching
   - Dashboard summary calculation
   
   **useOrders.ts:**
   - Order listing
   - Ads data fetching (duplicate dengan useDashboard!)
   - Escrow sync
   - Batch processing
   
   **useProducts.ts:**
   - Shop loading
   - Product loading
   - Product sync
   - Stock update

3. **Plan the Split**
   
   Contoh untuk `useDashboard.ts`:
   ```
   app/hooks/
   ├── useDashboard.ts (~100 lines - composition hook)
   ├── dashboard/
   │   ├── useDashboardOrders.ts (order subscription + processing)
   │   ├── useDashboardAds.ts (ads data fetching)
   │   └── useDashboardSummary.ts (summary calculation)
   ```

4. **Extract Domain-Specific Hook**
   
   ```typescript
   // app/hooks/dashboard/useDashboardOrders.ts
   import { useState, useCallback } from 'react';
   
   export function useDashboardOrders() {
     const [orders, setOrders] = useState<Order[]>([]);
     
     const fetchOrders = useCallback(async () => {
       // Logic from useDashboard
     }, []);
     
     return { orders, fetchOrders, ... };
   }
   ```

5. **Create Composition Hook**
   
   Main hook jadi thin wrapper:
   ```typescript
   // app/hooks/useDashboard.ts
   import { useDashboardOrders } from './dashboard/useDashboardOrders';
   import { useDashboardAds } from './dashboard/useDashboardAds';
   import { useDashboardSummary } from './dashboard/useDashboardSummary';
   
   export function useDashboard() {
     const ordersHook = useDashboardOrders();
     const adsHook = useDashboardAds();
     const summary = useDashboardSummary(ordersHook.orders);
     
     return {
       ...ordersHook,
       ...adsHook,
       summary,
     };
   }
   ```

6. **Remove Duplicates**
   
   Jika ada logic yang sama di multiple hooks (e.g., ads fetching):
   - Buat shared hook: `useAdsData.ts`
   - Import di kedua tempat

// turbo
7. **Verify Build**
   ```bash
   npm run build
   ```

8. **Manual Testing**
   - Test dashboard page
   - Test orders page
   - Verify data loading correctly

## Success Criteria
- [ ] Setiap hook < 200 lines
- [ ] Single responsibility per hook
- [ ] Tidak ada duplicate logic
- [ ] Build berhasil
