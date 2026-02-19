---
description: Membersihkan console.log/console.error dari codebase untuk production-ready code
---

# Console Log Cleanup Workflow

## Prerequisites
- Pastikan tidak ada perubahan uncommitted: `git status`

## Steps

// turbo
1. Cek jumlah console.log saat ini:
```bash
grep -r "console\.\(log\|error\|warn\)" app/ lib/ components/ --include="*.ts" --include="*.tsx" | wc -l
```

// turbo
2. Buat file logger utility:
```bash
cat > lib/logger.ts << 'EOF'
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args), // Keep errors
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  debug: (...args: unknown[]) => isDev && console.log('[DEBUG]', ...args),
};
EOF
```

3. Untuk setiap file dengan console.log:
   - Evaluasi apakah log tersebut **diperlukan untuk debugging** atau hanya **development noise**
   - Jika development noise → **hapus**
   - Jika diperlukan → **ganti dengan `logger.log()` atau `logger.debug()`**
   - Jika error handling → **keep `console.error()` atau ganti `logger.error()`**

4. Prioritas file (mulai dari yang paling banyak console.log):
   - `app/services/` (23 files)
   - `app/api/` (31 files) 
   - `app/hooks/` (16 files)

// turbo
5. Verifikasi build masih jalan:
```bash
npm run build
```

// turbo
6. Verifikasi jumlah console.log berkurang:
```bash
grep -r "console\.\(log\|error\|warn\)" app/ lib/ components/ --include="*.ts" --include="*.tsx" | wc -l
```

## Success Criteria
- [ ] Tidak ada `console.log` di production code (kecuali intentional)
- [ ] `console.error` dipertahankan untuk error handling
- [ ] Build berhasil tanpa error
