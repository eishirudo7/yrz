---
description: Konsolidasi type definitions yang duplikat ke folder /types
---

# Type Consolidation Workflow

## Prerequisites
- Pastikan tidak ada perubahan uncommitted: `git status`
- Backup atau commit current state

## Steps

// turbo
1. List semua interface yang didefinisikan di hooks:
```bash
grep -n "^interface\|^type\|^export interface\|^export type" app/hooks/*.ts
```

// turbo
2. List interface di types folder:
```bash
cat types/index.ts
```

3. Identifikasi duplicates (interface yang sama di multiple files):
   - `Order` → ada di `useOrders.ts`, `useDashboard.ts`, `MiniChat.tsx`
   - `Shop` → ada di `useProducts.ts`, `useDashboard.ts`
   - `Product` → ada di `useProducts.ts`

4. Untuk setiap duplicated interface:

   a. Buat file baru di `/types/` jika belum ada:
   ```bash
   # Contoh untuk Order
   touch types/order.ts
   ```

   b. Copy interface definition ke file types baru

   c. Export dari `types/index.ts`:
   ```typescript
   export type { Order, OrderItem } from './order';
   ```

   d. Update semua file yang menggunakan interface tersebut:
   ```typescript
   // Before
   interface Order { ... }
   
   // After
   import type { Order } from '@/types';
   ```

5. File-file yang perlu diupdate:
   - [ ] `app/hooks/useOrders.ts` - hapus local Order interface
   - [ ] `app/hooks/useDashboard.ts` - hapus local Order, Shop interface
   - [ ] `app/hooks/useProducts.ts` - hapus local Shop, Product interface
   - [ ] `components/MiniChat.tsx` - hapus local Order interface
   - [ ] `app/(dashboard)/dashboard/TableOrder.tsx` - import dari types

// turbo
6. Verifikasi TypeScript compilation:
```bash
npm run build
```

// turbo
7. Verifikasi tidak ada duplicate interface lagi:
```bash
grep -c "^interface Order\|^export interface Order" app/hooks/*.ts components/*.tsx
```

## Success Criteria
- [ ] Semua shared interfaces di `/types/`
- [ ] Tidak ada duplicate interface definitions
- [ ] Build berhasil tanpa error
- [ ] Semua imports menggunakan `@/types`
