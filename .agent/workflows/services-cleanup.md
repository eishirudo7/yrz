---
description: Membersihkan dan menyederhanakan services layer dengan struktur yang konsisten
---

# Services Layer Cleanup Workflow

## Current Structure
```
app/services/          # Frontend-facing services
├── shopee/            # Shopee domain services (9 files)
├── shopeeService.ts   # Re-export barrel (OK ✓)
├── bookingService.ts  # Direct Supabase operations
└── ...

lib/shopee/            # Core API wrapper (10 files)
├── index.ts           # ShopeeAPI class + modular exports
├── client.ts          # HTTP client
├── auth.ts
├── orders.ts
└── ...
```

## Issues
1. `app/services/shopee/` dan `lib/shopee/` overlap functionality
2. `databaseOperations.ts` imports dari old pattern
3. Inconsistent naming (camelCase vs kebab-case)

## Steps

// turbo
1. **Audit Current Services**
   ```bash
   # List all services
   find app/services -name "*.ts" -type f | head -25
   find lib -name "*.ts" -type f | head -15
   ```

// turbo
2. **Check Import Patterns**
   ```bash
   # Find what imports from lib/shopee
   grep -r "from '@/lib/shopee" app/ --include="*.ts" --include="*.tsx" | head -20
   
   # Find what imports from app/services/shopee
   grep -r "from '@/app/services/shopee" app/ --include="*.ts" --include="*.tsx" | head -20
   ```

3. **Clarify Responsibility Boundary**
   
   **Recommended Structure:**
   ```
   lib/shopee/              # LOW-LEVEL: HTTP calls to Shopee API
   ├── client.ts            # Base HTTP client
   ├── auth.ts              # Token management
   ├── orders.ts            # Order API calls
   └── ...
   
   app/services/            # HIGH-LEVEL: Business logic + DB
   ├── order/               # Order-related operations
   │   ├── orderService.ts  # Uses lib/shopee + Supabase
   │   └── orderSync.ts
   ├── booking/
   │   └── bookingService.ts
   └── ...
   ```

4. **For Each Service File:**
   
   a. Check if it calls Shopee API directly:
      - YES → Move logic to `lib/shopee/`
      - NO → Keep in `app/services/`
   
   b. Check if it does database operations:
      - YES → Keep in `app/services/`
      - NO → Consider if needed at all

5. **Update Imports**
   
   After restructuring, update all imports consistently:
   ```typescript
   // API calls
   import { getOrderDetail } from '@/lib/shopee';
   
   // Business logic
   import { saveOrder } from '@/app/services/order/orderService';
   ```

// turbo
6. **Verify Build**
   ```bash
   npm run build
   ```

7. **Manual Testing**
   - Test order sync functionality
   - Test booking operations
   - Verify API calls work

## Success Criteria
- [ ] Clear separation: `lib/` = API, `app/services/` = business logic
- [ ] No duplicate functionality between layers
- [ ] Consistent import patterns
- [ ] Build berhasil
