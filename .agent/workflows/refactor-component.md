---
description: Memecah komponen besar (>500 lines) menjadi komponen yang lebih kecil dan modular
---

# Component Refactoring Workflow

Gunakan workflow ini untuk memecah komponen besar menjadi lebih modular.

## Prerequisites
- Pastikan tidak ada perubahan uncommitted: `git status`
- Identifikasi target component dan perkiraan struktur baru

## Target Components
| File | Lines | Priority |
|------|-------|----------|
| `TableOrder.tsx` | 2,286 | High |
| `orders/page.tsx` | 1,309 | High |
| `MiniChat.tsx` | 1,229 | Medium |
| `ProfitCalculator.tsx` | ~1,200 | Medium |

## Steps

1. **Analyze Component Structure**
   
   View file outline untuk memahami struktur:
   ```bash
   # Gunakan view_file_outline tool atau:
   head -100 [TARGET_FILE]
   ```
   
   Identifikasi:
   - Sub-components yang bisa diekstrak
   - Hooks/logic yang bisa dipisah
   - Helper functions yang bisa dipindah

2. **Plan the Split**
   
   Buat struktur folder baru:
   ```
   [component]/
   ├── index.tsx          # Main component (orchestration only)
   ├── components/        # Sub-components
   │   ├── ComponentA.tsx
   │   └── ComponentB.tsx
   ├── hooks/             # Component-specific hooks
   │   └── useComponentLogic.ts
   └── utils/             # Helper functions
       └── helpers.ts
   ```

3. **Extract Helper Functions First**
   
   Identifikasi pure functions dan pindahkan ke `utils/`:
   ```typescript
   // utils/helpers.ts
   export function formatDate(timestamp: number): string { ... }
   export function calculateTotal(items: Item[]): number { ... }
   ```

4. **Extract Sub-Components**
   
   Untuk setiap sub-component:
   - Identifikasi props yang dibutuhkan
   - Buat interface untuk props
   - Pindahkan JSX dan logic terkait
   - Tambahkan `React.memo()` jika appropriate
   - Tambahkan `displayName`

   ```typescript
   // components/SubComponent.tsx
   interface SubComponentProps {
     data: DataType;
     onAction: () => void;
   }
   
   export const SubComponent = React.memo(({ data, onAction }: SubComponentProps) => {
     // Component logic
     return <div>...</div>;
   });
   
   SubComponent.displayName = 'SubComponent';
   ```

5. **Extract Custom Hooks**
   
   Untuk logic yang complex:
   ```typescript
   // hooks/useComponentLogic.ts
   export function useComponentLogic(initialData: Data) {
     const [state, setState] = useState(initialData);
     
     const handlers = useMemo(() => ({
       handleAction: () => { ... },
     }), []);
     
     return { state, ...handlers };
   }
   ```

6. **Update Main Component**
   
   Main component seharusnya hanya:
   - Import sub-components
   - Use custom hooks
   - Orchestrate layout
   - Handle top-level state

// turbo
7. **Verify Build**
   ```bash
   npm run build
   ```

8. **Manual Testing**
   - Buka halaman yang menggunakan component
   - Test semua functionality
   - Check console untuk errors

## Example: TableOrder.tsx Refactor

Target structure:
```
app/(dashboard)/dashboard/
├── TableOrder.tsx (~500 lines)
├── components/
│   ├── Dialog.tsx ✓ (existing)
│   ├── Table.tsx ✓ (existing)
│   ├── OrderFilters.tsx (NEW)
│   ├── OrderActions.tsx (NEW)
│   └── PrintingManager.tsx (NEW)
└── hooks/
    ├── useOrderFiltering.ts (NEW)
    └── useOrderPrinting.ts (NEW)
```

## Success Criteria
- [ ] Main component < 500 lines
- [ ] Each sub-component < 300 lines
- [ ] Build berhasil
- [ ] Semua functionality tetap bekerja
- [ ] No console errors
