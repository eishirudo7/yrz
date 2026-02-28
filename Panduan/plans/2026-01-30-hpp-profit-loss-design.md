# HPP dan Laporan Laba Rugi

Sistem untuk mengelola HPP (Harga Pokok Penjualan) dan menghitung laba rugi per toko, produk, dan periode. Terintegrasi di halaman Orders dengan tab system.

## User Review Required

> [!IMPORTANT]
> **Matching Variasi Tier 1**: HPP akan di-match berdasarkan nama variasi (model_name) dari order_items. Jika ada typo atau perbedaan penulisan antar toko (misal "Lengan Panjang" vs "lengan panjang"), matching akan menggunakan **case-insensitive**.

> [!WARNING]
> **Order Tanpa HPP**: Order dengan item yang belum ada HPP akan tetap ditampilkan, tapi dengan HPP = 0 dan warning icon.

---

## Proposed Changes

### Database Schema

#### [NEW] Migration: `create_hpp_master_table`

Membuat tabel `hpp_master` untuk menyimpan HPP per SKU dan variasi Tier 1:

```sql
CREATE TABLE hpp_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,                    -- Parent SKU (lowercase, case-insensitive)
  tier1_name TEXT,                      -- Nama variasi Tier 1 (NULL = default untuk semua)
  hpp NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,                           -- Catatan opsional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_sku_tier1 UNIQUE (sku, tier1_name)
);

-- Index untuk pencarian cepat
CREATE INDEX idx_hpp_master_sku ON hpp_master(sku);

-- Trigger untuk auto-update updated_at
CREATE TRIGGER update_hpp_master_updated_at
  BEFORE UPDATE ON hpp_master
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### API Routes

#### [NEW] [hpp/route.ts](file:///Users/yorozuya/Developer/next/zavena/src/app/api/hpp/route.ts)

CRUD API untuk HPP master data:

- `GET /api/hpp` - List semua HPP dengan filter SKU
- `GET /api/hpp?sku=xxx` - Get HPP untuk SKU tertentu
- `POST /api/hpp` - Create/Update HPP
- `DELETE /api/hpp?id=xxx` - Delete HPP entry

---

#### [NEW] [hpp/unique-skus/route.ts](file:///Users/yorozuya/Developer/next/zavena/src/app/api/hpp/unique-skus/route.ts)

API untuk mendapatkan daftar SKU unik dari order_items dengan status HPP:

- `GET /api/hpp/unique-skus` - Return list SKU dengan:
  - SKU name
  - Nama produk (sample)
  - List variasi Tier 1 yang ditemukan
  - Status HPP (lengkap/sebagian/belum)

---

#### [NEW] [reports/profit-loss/route.ts](file:///Users/yorozuya/Developer/next/zavena/src/app/api/reports/profit-loss/route.ts)

API untuk laporan laba rugi:

- `GET /api/reports/profit-loss?start_date=xxx&end_date=xxx&shop_id=xxx`
- Return:
  - Ringkasan per toko (escrow, HPP, laba kotor, biaya iklan, laba bersih)
  - Ringkasan per produk (SKU, qty, revenue, HPP, margin)
  - Ringkasan per periode (daily breakdown)
  - Alert: daftar order dengan item tanpa HPP

---

### Frontend Components

#### [MODIFY] [orders/page.tsx](file:///Users/yorozuya/Developer/next/zavena/src/app/orders/page.tsx)

Refactor menjadi tab-based layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Orders                                                     │
│  ┌─────────┐ ┌───────────┐ ┌─────────────┐ ┌──────────────┐│
│  │ Orders  │ │ Laba Rugi │ │ Per Produk  │ │ Kelola HPP   ││
│  └─────────┘ └───────────┘ └─────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- Menggunakan Tabs component dari shadcn/ui
- State management untuk active tab

---

#### [NEW] [components/orders/hpp-manager.tsx](file:///Users/yorozuya/Developer/next/zavena/src/components/orders/hpp-manager.tsx)

Component untuk tab "Kelola HPP":

- Tabel list SKU unik dengan status HPP
- Filter dan search
- Modal untuk edit HPP per SKU dengan variasi

---

#### [NEW] [components/orders/profit-loss-report.tsx](file:///Users/yorozuya/Developer/next/zavena/src/components/orders/profit-loss-report.tsx)

Component untuk tab "Laba Rugi":

- Date range picker
- Shop filter
- Cards ringkasan (Total Escrow, HPP, Laba Kotor, Biaya Iklan, Laba Bersih)
- Tabel breakdown per toko
- Alert untuk order tanpa HPP

---

#### [NEW] [components/orders/product-profitability.tsx](file:///Users/yorozuya/Developer/next/zavena/src/components/orders/product-profitability.tsx)

Component untuk tab "Per Produk":

- Tabel dengan kolom: SKU, Nama, Qty, Revenue, HPP Total, Laba, Margin %
- Expandable rows untuk breakdown per variasi Tier 1
- Sorting dan filter

---

## Verification Plan

### Manual Verification

Karena project tidak memiliki automated tests, verifikasi dilakukan manual:

**1. Database Migration**
```bash
# Cek tabel berhasil dibuat via Supabase MCP
# Lihat struktur tabel hpp_master
```

**2. HPP API**
```bash
# Test via browser atau curl:
# GET http://localhost:3000/api/hpp
# POST http://localhost:3000/api/hpp dengan body { sku, tier1_name, hpp }
```

**3. UI Testing (Browser)**
- Buka halaman `/orders`
- Verifikasi 4 tab muncul: Orders, Laba Rugi, Per Produk, Kelola HPP
- Di tab "Kelola HPP":
  - Lihat list SKU unik
  - Klik edit, input HPP, simpan
  - Verifikasi HPP tersimpan
- Di tab "Laba Rugi":
  - Pilih date range
  - Verifikasi data laba rugi muncul
  - Verifikasi biaya iklan terintegrasi
- Di tab "Per Produk":
  - Verifikasi breakdown per SKU muncul
  - Expand lihat variasi

**4. Calculation Verification**
- Ambil sample order dengan escrow_amount diketahui
- Set HPP untuk items di order tersebut
- Verifikasi perhitungan: Laba Kotor = escrow_amount - total HPP
- Verifikasi Laba Bersih = Laba Kotor - Biaya Iklan
