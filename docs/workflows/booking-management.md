# Booking Management Workflow

Alur pengelolaan COD booking orders (pesanan bayar di tempat).

## Diagram Alur

```mermaid
flowchart TB
    subgraph Sync["1️⃣ Sync Bookings"]
        A[Shopee API] -->|getBookingList| B[Fetch Bookings]
        B --> C[bookingSyncs.ts]
        C -->|saveBookingOrders| D[(Supabase DB)]
    end

    subgraph Display["2️⃣ Display"]
        D --> E[useBookings.ts]
        E --> F[Booking Page]
    end

    subgraph Ship["3️⃣ Ship Booking"]
        F -->|Select bookings| G[/api/bookings/ship]
        G --> H[getBookingShippingParameter]
        H --> I[shipBooking]
        I --> J[Shopee API]
    end

    subgraph Track["4️⃣ Tracking"]
        J -->|Get tracking| K[getBookingTrackingNumber]
        K --> L[updateTrackingNumber]
        L --> D
    end

    subgraph Doc["5️⃣ Print Document"]
        D --> M[/api/shipping-document/booking]
        M --> N[createBookingShippingDocument]
        N --> O[downloadBookingShippingDocument]
        O --> P[PDF Resi]
    end
```

---

## Step-by-Step

### 1. Sync Bookings dari Shopee

**File:** [bookingSyncs.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/services/bookingSyncs.ts)

```
1. Trigger sync (auto atau manual)
2. Untuk setiap shop:
   a. getValidAccessToken(shopId)
   b. getBookingList(shopId, token, options)
   c. getBookingDetail(shopId, token, bookingSnList)
   d. saveBookingOrders(bookings, shopId) ke Supabase
```

### 2. Display Bookings

**File:** [useBookings.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/hooks/useBookings.ts)

```
1. Hook dipanggil dengan filters
2. getBookingOrdersFromDB(shopId, filters)
3. Results displayed dengan:
   - Booking status (PENDING_PICKUP, PROCESSING, etc)
   - Match status
   - Print status
```

### 3. Ship Booking

**Endpoint:** `/api/bookings`  
**File:** [bookings.ts (lib)](file:///Users/yorozuya/Developer/next/yorozuya/lib/shopee/bookings.ts)

```
1. User select bookings → click "Ship"
2. POST ke /api/bookings:
   {
     action: "ship",
     shop_id: number,
     booking_sn: string
   }
3. API route:
   a. getBookingShippingParameter(shopId, token, bookingSn)
   b. shipBooking(shopId, token, bookingSn, 'dropoff')
   c. getBookingTrackingNumber(shopId, token, bookingSn)
   d. updateTrackingNumber di DB
```

### 4. Print Shipping Document

**File:** [bookingService.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/services/bookingService.ts)

```
1. Bookings sudah shipped
2. User select → click "Print"
3. createBookingShippingDocument(shopId, token, bookingList)
4. downloadBookingShippingDocument(shopId, token, bookingList)
5. markDocumentsAsPrinted(shopId, bookingSnList)
6. Return PDF for printing
```

---

## Booking vs Order

| Aspect | Order | Booking (COD) |
|--------|-------|---------------|
| Payment | Prepaid | Cash on delivery |
| API Prefix | `/order/` | `/fulfillment/` |
| Status Flow | UNPAID → READY_TO_SHIP → SHIPPED | PENDING → PROCESSING → COMPLETED |
| Cancellation | buyer/seller dapat cancel | buyer dapat reject COD |

---

## Database Schema

**Table:** `booking_orders`

| Column | Type | Description |
|--------|------|-------------|
| shop_id | int | Shop ID |
| booking_sn | string | Booking number (PK) |
| order_sn | string | Related order number |
| booking_status | string | Status |
| match_status | string | Match status |
| tracking_number | string | Tracking number |
| is_printed | boolean | Document printed flag |
| recipient_address | jsonb | Shipping address |
| item_list | jsonb | Order items |

---

## Related Files

- [lib/shopee/bookings.ts](file:///Users/yorozuya/Developer/next/yorozuya/lib/shopee/bookings.ts) - Raw API calls
- [app/services/shopee/bookings.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/services/shopee/bookings.ts) - High-level operations
- [app/services/bookingService.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/services/bookingService.ts) - DB operations
- [app/hooks/useBookings.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/hooks/useBookings.ts) - Frontend hook
