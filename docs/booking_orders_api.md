# Booking Orders API Documentation

## Struktur Database

### Tabel: `booking_orders`

Tabel ini menyimpan data booking orders dari Shopee API dengan struktur berikut:

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | BIGSERIAL | Primary key |
| `shop_id` | BIGINT | ID toko (NOT NULL) |
| `booking_sn` | VARCHAR(50) | Nomor booking (NOT NULL) |
| `order_sn` | VARCHAR(50) | Nomor pesanan |
| `region` | VARCHAR(10) | Kode region (MY, ID, dll) |
| `booking_status` | VARCHAR(50) | Status booking |
| `match_status` | VARCHAR(50) | Status matching |
| `shipping_carrier` | TEXT | Kurir pengiriman |
| `create_time` | BIGINT | Timestamp pembuatan |
| `update_time` | BIGINT | Timestamp update |
| `recipient_address` | JSONB | Alamat penerima (JSON) |
| `item_list` | JSONB | Daftar item (JSON Array) |
| `dropshipper` | TEXT | Info dropshipper |
| `dropshipper_phone` | VARCHAR(50) | Telepon dropshipper |
| `cancel_by` | VARCHAR(50) | Dibatalkan oleh |
| `cancel_reason` | VARCHAR(100) | Alasan pembatalan |
| `fulfillment_flag` | VARCHAR(50) | Flag fulfillment |
| `pickup_done_time` | BIGINT | Timestamp pickup selesai |
| `tracking_number` | TEXT | Nomor resi/tracking |
| `is_printed` | BOOLEAN | Status apakah sudah dicetak |
| `document_status` | TEXT | Status dokumen (PENDING/READY/PRINTED/ERROR) |
| `created_at` | TIMESTAMP | Timestamp dibuat di DB |
| `updated_at` | TIMESTAMP | Timestamp diupdate di DB |

### Struktur JSONB

#### recipient_address
```json
{
  "name": "Nama Penerima",
  "phone": "081234567890",
  "town": "Kelurahan",
  "district": "Kecamatan", 
  "city": "Kota",
  "state": "Provinsi",
  "region": "ID",
  "zipcode": "12345",
  "full_address": "Alamat lengkap"
}
```

#### item_list
```json
[
  {
    "item_name": "Nama Produk",
    "item_sku": "SKU-123",
    "model_name": "Varian",
    "model_sku": "MODEL-SKU",
    "weight": 1000,
    "product_location_id": "LOC-ID",
    "image_info": {
      "image_url": "https://..."
    }
  }
]
```

## API Endpoints

### 1. GET /api/bookings - Mengambil Data Booking

#### Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `shop_id` | number | ✓ | ID toko |
| `action` | string | ✗ | "search", "ready_to_print" |
| `booking_status` | string | ✗ | Filter status booking |
| `booking_sn` | string | ✗ | Filter booking SN spesifik |
| `order_sn` | string | ✗ | Filter order SN spesifik |
| `tracking_number` | string | ✗ | Filter berdasarkan tracking number |
| `is_printed` | boolean | ✗ | Filter berdasarkan status cetak |
| `document_status` | string | ✗ | Filter berdasarkan status dokumen |
| `date_from` | string | ✗ | Tanggal mulai (YYYY-MM-DD) |
| `date_to` | string | ✗ | Tanggal akhir (YYYY-MM-DD) |
| `limit` | number | ✗ | Limit hasil (default: 50) |
| `offset` | number | ✗ | Offset pagination (default: 0) |

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "shop_id": 832664993,
      "booking_sn": "201214JASXYXY6",
      "order_sn": "201218V2Y6E59M",
      "booking_status": "CANCELLED",
      "tracking_number": "SPX12345678901",
      "is_printed": false,
      "document_status": "PENDING",
      "recipient_address": {
        "name": "Max",
        "phone": "3828203",
        "city": "Asajaya"
      },
      "item_list": [
        {
          "item_name": "backpack",
          "weight": 12
        }
      ]
    }
  ],
  "total": 1
}
```

### 2. GET /api/bookings?action=search - Pencarian Booking

#### Parameters Tambahan untuk Search

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `search` | string | ✓ | Teks pencarian |
| `fields` | string | ✗ | Field yang dicari (comma-separated) |

#### Fields yang Dapat Dicari
- `booking_sn` - Nomor booking
- `order_sn` - Nomor pesanan  
- `tracking_number` - Nomor tracking
- `recipient_name` - Nama penerima
- `item_name` - Nama item

#### Contoh Request
```
GET /api/bookings?shop_id=832664993&action=search&search=SPX123&fields=tracking_number,booking_sn
```

### 3. GET /api/bookings?action=ready_to_print - Booking Siap Cetak

Mengambil daftar booking yang siap untuk dicetak (is_printed=false, document_status=READY).

#### Contoh Request
```
GET /api/bookings?shop_id=832664993&action=ready_to_print
```

### 4. POST /api/bookings - Menyimpan/Update Data Booking

#### A. Menyimpan Data Booking (Default)

```json
{
  "shop_id": 832664993,
  "booking_list": [
    {
      "booking_sn": "201214JASXYXY6",
      "order_sn": "201218V2Y6E59M",
      "region": "MY",
      "booking_status": "CANCELLED",
      "tracking_number": "SPX12345678901",
      "is_printed": false,
      "document_status": "READY",
      "recipient_address": {
        "name": "Max",
        "phone": "3828203",
        "city": "Asajaya"
      },
      "item_list": [
        {
          "item_name": "backpack",
          "weight": 12
        }
      ]
    }
  ]
}
```

#### B. Update Tracking Number

```json
{
  "action": "update_tracking",
  "shop_id": 832664993,
  "booking_sn": "201214JASXYXY6",
  "tracking_number": "SPX12345678901"
}
```

#### C. Mark Documents as Printed

```json
{
  "action": "mark_printed",
  "shop_id": 832664993,
  "booking_sn_list": [
    "201214JASXYXY6",
    "201218V2Y6E59M"
  ]
}
```

#### Response
```json
{
  "success": true,
  "message": "Berhasil menyimpan 1 booking orders",
  "savedCount": 1
}
```

### 5. PUT /api/bookings - Update Data Booking

#### Request Body
```json
{
  "shop_id": 832664993,
  "booking_sn": "201214JASXYXY6",
  "update_data": {
    "booking_status": "COMPLETED",
    "tracking_number": "SPX12345678901",
    "is_printed": true,
    "document_status": "PRINTED",
    "pickup_done_time": 1608234567
  }
}
```

#### Response
```json
{
  "success": true,
  "message": "Berhasil mengupdate booking order",
  "data": {
    "id": 1,
    "booking_sn": "201214JASXYXY6",
    "booking_status": "COMPLETED",
    "tracking_number": "SPX12345678901"
  }
}
```

### 6. DELETE /api/bookings - Hapus Data Booking

#### Request Body
```json
{
  "shop_id": 832664993,
  "booking_sn_list": [
    "201214JASXYXY6",
    "201218V2Y6E59M"
  ]
}
```

#### Response
```json
{
  "success": true,
  "message": "Berhasil menghapus 2 booking orders",
  "deletedCount": 2
}
```

## Service Functions

### 1. saveBookingOrders()
Menyimpan array booking orders ke database dengan upsert (insert atau update).

```typescript
const result = await saveBookingOrders(bookings, shopId);
```

### 2. getBookingOrdersFromDB()
Mengambil booking orders dari database dengan filter dan pagination.

```typescript
const result = await getBookingOrdersFromDB(shopId, {
  booking_status: 'PENDING',
  is_printed: false,
  document_status: 'READY',
  limit: 20,
  offset: 0
});
```

### 3. searchBookingOrders()
Mencari booking orders berdasarkan teks dan field tertentu.

```typescript
const result = await searchBookingOrders(shopId, 'SPX123', ['tracking_number']);
```

### 4. updateBookingOrder()
Mengupdate data booking order tertentu.

```typescript
const result = await updateBookingOrder(shopId, bookingSn, {
  tracking_number: 'SPX12345678901',
  document_status: 'READY'
});
```

### 5. updateTrackingNumber()
Update tracking number khusus untuk booking order.

```typescript
const result = await updateTrackingNumber(shopId, bookingSn, 'SPX12345678901');
```

### 6. markDocumentsAsPrinted()
Mark multiple booking orders sebagai sudah dicetak.

```typescript
const result = await markDocumentsAsPrinted(shopId, ['booking1', 'booking2']);
```

### 7. getBookingsReadyToPrint()
Mendapatkan booking orders yang siap untuk dicetak.

```typescript
const result = await getBookingsReadyToPrint(shopId);
```

### 8. deleteBookingOrders()
Menghapus booking orders berdasarkan booking SN.

```typescript
const result = await deleteBookingOrders(shopId, ['booking1', 'booking2']);
```

## Integrasi dengan Halaman Shops

### Sinkronisasi Otomatis

Ketika tombol **"Sinkronisasi"** diklik di halaman shops (`/shops`), sistem akan secara otomatis:

1. **Mensinkronkan Orders** - Mengambil dan menyimpan data pesanan terbaru
2. **Mensinkronkan Booking Orders** - Mengambil dan menyimpan data booking orders terbaru
3. **Update Tracking Numbers** - Untuk SEMUA booking orders, sistem mencoba mengambil tracking number dari Shopee API

### Endpoint Sinkronisasi: POST /api/sync

#### Request Body
```json
{
  "shopId": 832664993,
  "includeBookings": true,
  "orderSns": [], // Optional: specific orders
  "bookingSns": [] // Optional: specific bookings
}
```

#### Streaming Response Format

Endpoint ini menggunakan **Server-Sent Events (SSE)** untuk memberikan progress update real-time:

```json
// Progress update untuk orders
{
  "phase": "Mensinkronkan Orders",
  "type": "orders",
  "processed": 15,
  "total": 50,
  "percentage": 30,
  "timestamp": "2024-01-15T10:30:00Z"
}

// Progress update untuk booking orders
{
  "phase": "Mensinkronkan Booking Orders", 
  "type": "bookings",
  "processed": 8,
  "total": 25,
  "percentage": 32,
  "timestamp": "2024-01-15T10:31:00Z"
}

// Progress gabungan
{
  "phase": "Mensinkronkan Booking Orders",
  "type": "combined",
  "processed": 23,
  "total": 75,
  "percentage": 31,
  "details": {
    "orders": { "processed": 15, "total": 50 },
    "bookings": { "processed": 8, "total": 25 }
  },
  "timestamp": "2024-01-15T10:31:00Z"
}

// Hasil akhir
{
  "success": true,
  "completed": true,
  "data": {
    "orders": {
      "total": 50,
      "processed": 48,
      "success": 48,
      "failed": 2
    },
    "bookings": {
      "total": 25,
      "processed": 24,
      "success": 24,
      "failed": 1
    },
    "summary": {
      "total": 75,
      "processed": 72,
      "success": 72,
      "failed": 3
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:32:00Z",
    "processingTime": 120000
  }
}
```

### UI Progress Display

Di halaman shops, progress sinkronisasi ditampilkan dengan:

1. **Phase Indicator** - Menampilkan fase saat ini (Orders/Booking Orders)
2. **Progress Bar** - Visual progress dengan persentase
3. **Counter** - Menampilkan `current/total` items processed
4. **Real-time Updates** - Progress diupdate secara real-time tanpa refresh

```tsx
{/* Progress display di ShopCard */}
{syncStatus[shop.shop_id]?.isSyncing && (
  <div className="bg-blue-50 p-2 rounded-md">
    {/* Phase indicator */}
    {syncStatus[shop.shop_id]?.phase && (
      <p className="text-xs text-blue-700 mb-1">
        {syncStatus[shop.shop_id]?.phase}
      </p>
    )}
    
    {/* Progress bar */}
    <div className="w-full bg-blue-100 rounded-full h-1.5">
      <div 
        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
    
    {/* Counter */}
    <p className="text-xs text-blue-600 mt-1">
      {current}/{total}
    </p>
  </div>
)}
```

### Service Layer: bookingSyncs.ts

#### syncBookings()
Mensinkronkan semua booking orders untuk toko tertentu.

```typescript
const result = await syncBookings(shopId, {
  timeRangeField: 'create_time',
  startTime: sevenDaysAgo,
  endTime: now,
  bookingStatus: 'ALL',
  onProgress: (progress) => {
    // Update UI progress
    console.log(`Progress: ${progress.current}/${progress.total}`);
  }
});
```

#### syncBookingsByBookingSns()
Mensinkronkan booking orders spesifik berdasarkan booking SN.

```typescript
const result = await syncBookingsByBookingSns(shopId, ['booking1', 'booking2'], {
  onProgress: (progress) => {
    // Update UI progress
  }
});
```

### Fitur Otomatis

1. **Auto Tracking Update** - Untuk SEMUA booking orders, sistem otomatis mencoba mengambil tracking number dari Shopee API (tidak terbatas pada status SHIPPED/COMPLETED)
2. **Document Status Management** - Status dokumen dikelola di proses pembuatan dokumen, bukan dari sinkronisasi (tetap PENDING dari sync)
3. **Error Handling** - Jika ada error pada booking tertentu, proses tetap berlanjut untuk booking lainnya
4. **Batch Processing** - Booking diproses dalam batch untuk efisiensi dan menghindari rate limiting

## Query Examples

### Mencari berdasarkan alamat penerima
```sql
SELECT * FROM booking_orders 
WHERE shop_id = 832664993 
AND recipient_address->>'city' = 'Jakarta';
```

### Mencari berdasarkan tracking number
```sql
SELECT * FROM booking_orders 
WHERE shop_id = 832664993 
AND tracking_number = 'SPX12345678901';
```

### Booking yang belum dicetak
```sql
SELECT * FROM booking_orders 
WHERE shop_id = 832664993 
AND is_printed = false 
AND document_status = 'READY';
```

### Filter berdasarkan status dokumen
```sql
SELECT * FROM booking_orders 
WHERE shop_id = 832664993 
AND document_status IN ('PENDING', 'READY');
```

### Filter berdasarkan tanggal dan status cetak
```sql
SELECT * FROM booking_orders 
WHERE shop_id = 832664993 
AND create_time >= 1607930000 
AND create_time <= 1608036000
AND is_printed = true;
```

## Document Status Flow

Status dokumen mengikuti alur berikut:

1. **PENDING** - Default untuk booking baru, tidak diubah dari sinkronisasi meskipun sudah ada tracking number
2. **READY** - Dikelola oleh proses pembuatan dokumen, bukan dari sinkronisasi
3. **PRINTED** - Dokumen sudah dicetak
4. **ERROR** - Terjadi error dalam proses

## Print Management Workflow

### 1. Sync Booking dari Shopee API
```typescript
// Ambil booking list dari Shopee
const bookingResponse = await getBookingList(shopId, options);

// 2. Simpan ke database  
if (bookingResponse.success) {
  await saveBookingOrders(bookingResponse.data.booking_list, shopId);
}

// 3. SELALU coba ambil tracking number untuk SEMUA booking
for (const booking of bookingResponse.data.booking_list) {
  const trackingResponse = await getBookingTrackingNumber(shopId, booking.booking_sn);
  if (trackingResponse.success && trackingResponse.data.tracking_number) {
    await updateTrackingNumber(shopId, booking.booking_sn, trackingResponse.data.tracking_number);
    // Document status tetap PENDING, tidak diubah dari sinkronisasi
  }
}
```

### 2. Update Tracking Number
```typescript
// Dari Shopee API atau manual input
await updateTrackingNumber(shopId, bookingSn, trackingNumber);
// Document status tetap tidak berubah (masih PENDING)
```

### 3. Proses Pembuatan Dokumen
```typescript
// Document status dikelola di proses pembuatan dokumen
// Status berubah dari PENDING -> READY -> PRINTED di tempat yang sesuai
```

### 4. Mark as Printed
```typescript
const bookingSnList = ['booking1', 'booking2'];
await markDocumentsAsPrinted(shopId, bookingSnList);
// Status otomatis menjadi 'PRINTED', is_printed=true
```

## Security

- **Authentication**: Semua endpoint memerlukan user authentication melalui Supabase Auth
- **Authorization**: User hanya bisa akses data toko yang dimilikinya
- **RLS**: Row Level Security diaktifkan untuk keamanan level database
- **Validation**: Input validation di semua endpoint

## Performance

- **Indexing**: Index dibuat untuk field yang sering diquery termasuk tracking_number, is_printed, document_status
- **JSONB**: Menggunakan GIN index untuk query JSONB yang efisien
- **Pagination**: Mendukung offset dan limit untuk handling data besar
- **Upsert**: Menggunakan upsert untuk efisiensi saat sync data
- **Batch Processing**: Booking diproses dalam batch untuk menghindari rate limiting
- **Streaming**: Real-time progress updates menggunakan Server-Sent Events

## Error Handling

Semua endpoint mengembalikan format error yang konsisten:

```json
{
  "success": false,
  "message": "Pesan error yang jelas",
  "error": "error_code" // opsional
}
```

## Integration dengan Shopee API

### Auto-sync dengan Tracking
```typescript
// 1. Ambil booking list
const bookingResponse = await getBookingList(shopId, options);

// 2. Simpan ke database  
if (bookingResponse.success) {
  await saveBookingOrders(bookingResponse.data.booking_list, shopId);
}

// 3. SELALU coba ambil tracking number untuk SEMUA booking
for (const booking of bookingResponse.data.booking_list) {
  const trackingResponse = await getBookingTrackingNumber(shopId, booking.booking_sn);
  if (trackingResponse.success && trackingResponse.data.tracking_number) {
    await updateTrackingNumber(shopId, booking.booking_sn, trackingResponse.data.tracking_number);
    // Document status tetap PENDING, tidak diubah dari sinkronisasi
  }
}
``` 