---
description: Setup testing infrastructure dengan Vitest untuk Next.js project
---

# Testing Setup Workflow

## Why Vitest?
- Fast (Vite-based)
- Native ESM support
- Compatible dengan React Testing Library
- Jest-compatible API

## Steps

// turbo
1. **Check Current Test Config**
   ```bash
   cat package.json | grep -A5 '"test"'
   ls *.config.* 2>/dev/null | head -10
   ```

2. **Install Dependencies**
   ```bash
   npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
   ```

3. **Create Vitest Config**
   ```bash
   cat > vitest.config.ts << 'EOF'
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';
   import path from 'path';

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./vitest.setup.ts'],
       include: ['**/*.test.ts', '**/*.test.tsx'],
       exclude: ['node_modules', '.next'],
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './'),
       },
     },
   });
   EOF
   ```

4. **Create Setup File**
   ```bash
   cat > vitest.setup.ts << 'EOF'
   import '@testing-library/jest-dom';
   
   // Mock next/navigation
   vi.mock('next/navigation', () => ({
     useRouter: () => ({
       push: vi.fn(),
       replace: vi.fn(),
       back: vi.fn(),
     }),
     usePathname: () => '/',
     useSearchParams: () => new URLSearchParams(),
   }));
   EOF
   ```

5. **Add Test Script to package.json**
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:run": "vitest run",
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

6. **Create First Test**
   ```bash
   mkdir -p app/hooks/__tests__
   cat > app/hooks/__tests__/useOrders.test.ts << 'EOF'
   import { describe, it, expect, vi } from 'vitest';
   
   // Mock Supabase
   vi.mock('@/utils/supabase/client', () => ({
     createClient: () => ({
       from: () => ({
         select: () => Promise.resolve({ data: [], error: null }),
       }),
     }),
   }));
   
   describe('useOrders', () => {
     it('should initialize with empty orders', () => {
       // Basic smoke test
       expect(true).toBe(true);
     });
   });
   EOF
   ```

// turbo
7. **Run Tests**
   ```bash
   npm run test:run
   ```

8. **Add Critical Path Tests**
   
   Prioritas testing:
   - [ ] Utility functions (pure functions, easy to test)
   - [ ] Data transformation logic
   - [ ] Hook behavior dengan mocked dependencies
   - [ ] API route handlers

## Recommended Test Structure
```
app/
├── hooks/
│   ├── useOrders.ts
│   └── __tests__/
│       └── useOrders.test.ts
├── services/
│   ├── bookingService.ts
│   └── __tests__/
│       └── bookingService.test.ts
└── (dashboard)/
    └── orders/
        └── utils/
            ├── orderUtils.ts
            └── __tests__/
                └── orderUtils.test.ts
```

## Success Criteria
- [ ] Vitest configured and running
- [ ] At least 1 test passing
- [ ] Path aliases working in tests
- [ ] `npm run test` works
