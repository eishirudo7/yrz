# Order Processing Workflow

Alur pemrosesan pesanan dari menerima pesanan hingga pengiriman.

## Diagram Alur

```mermaid
flowchart TB
    subgraph Sync["1️⃣ Data Sync"]
        A[Shopee API] -->|getOrderList| B[Fetch Orders]
        B --> C[orderSyncs.ts]
        C -->|upsertOrderData| D[(Supabase DB)]
    end

    subgraph Display["2️⃣ Display"]
        D --> E[useOrders.ts hook]
        E --> F[TableOrder.tsx]
    end

    subgraph Process["3️⃣ Process Order"]
        F -->|User clicks 'Proses'| G[/api/process-order]
        G --> H[shipOrder]
        H --> I[Shopee API]
        I -->|Success| J[Update DB status]
    end

    subgraph Doc["4️⃣ Shipping Document"]
        J --> K[/api/shipping-document]
        K --> L[createShippingDocument]
        L --> M[downloadShippingDocument]
        M --> N[PDF Resi]
    end
```

---

## Step-by-Step

### 1. Sync Orders dari Shopee

**File:** [orderSyncs.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/services/orderSyncs.ts)

```
1. User login → UserDataContext mengambil daftar shops
2. Auto-sync atau manual sync triggered
3. Untuk setiap shop:
   a. getValidAccessToken(shopId) → ambil token dari Redis/DB
   b. shopeeApi.getOrderList(shopId, token, options)
   c. Loop setiap order:
      - shopeeApi.getOrderDetail(shopId, orderSn, token)
      - upsertOrderData(orderData, shopId)
      - upsertOrderItems(orderData)
      - upsertLogisticData(orderData, shopId)
```

### 2. Display Orders di Dashboard

**File:** [useOrders.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/hooks/useOrders.ts)

```
1. Hook dipanggil dengan dateRange parameter
2. Fetch ke /api/orders dengan filter:
   - shop_ids (dari UserDataContext)
   - date_from, date_to
   - order_status (optional)
3. Data ditampilkan di TableOrder component
4. Support filtering, search, pagination
```

### 3. Process Order (Ship)

**Endpoint:** `/api/process-order`  
**File:** [orders.ts (lib)](file:///Users/yorozuya/Developer/next/yorozuya/lib/shopee/orders.ts#L89-L120)

```
1. User select orders → click "Proses"
2. Frontend POST ke /api/process-order:
   {
     shop_id: number,
     order_sn: string,
     pickup?: { address_id, pickup_time_id }
   }
3. API route:
   a. getValidAccessToken(shopId)
   b. getShippingParameter(shopId, orderSn, token)
   c. shipOrder(shopId, orderSn, token, pickup/dropoff)
4. Response success → update order status di DB
```

### 4. Download Shipping Document

**Endpoint:** `/api/shipping-document`  
**File:** [logistics.ts](file:///Users/yorozuya/Developer/next/yorozuya/lib/shopee/logistics.ts)

```
1. Order sudah shipped → tracking_number assigned
2. User click "Print Resi"
3. POST ke /api/shipping-document/download:
   {
     shop_id: number,
     order_list: [{ order_sn, ... }]
   }
4. API route:
   a. createShippingDocument(shopId, token, orderList)
   b. Wait for document ready
   c. downloadShippingDocument(shopId, token, orderList)
   d. Return PDF binary
5. Frontend display PDF untuk print
```

---

## Error Handling

| Error | Handling |
|-------|----------|
| Token expired | Auto-refresh via tokenManager |
| Order already shipped | Skip dengan warning |
| Shopee API error | Retry 3x dengan delay |
| Network timeout | Show toast error |

---

## Related Files

- [lib/shopee/orders.ts](file:///Users/yorozuya/Developer/next/yorozuya/lib/shopee/orders.ts) - Raw Shopee API calls
- [app/services/shopee/orders.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/services/shopee/orders.ts) - High-level operations
- [app/services/databaseOperations.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/services/databaseOperations.ts) - DB operations
- [app/hooks/useOrders.ts](file:///Users/yorozuya/Developer/next/yorozuya/app/hooks/useOrders.ts) - Frontend hook
