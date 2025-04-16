# API Tracking ShopeeXpress

API ini digunakan untuk mendapatkan informasi tracking paket dari ShopeeXpress berdasarkan nomor resi.

## Penggunaan

```
GET /api/tracking?tracking_number=SPXID123456789
```

### Parameter Query

| Parameter | Tipe | Deskripsi | Wajib |
|-----------|------|-----------|-------|
| tracking_number | string | Nomor resi ShopeeXpress | Ya |

### Response Sukses

```json
{
  "success": true,
  "tracking_number": "SPXID055128932124",
  "data": {
    "fulfillment_info": {
      "deliver_type": 1
    },
    "sls_tracking_info": {
      "sls_tn": "ID257312704292D",
      "client_order_id": "5675260985067020993",
      "receiver_name": "",
      "receiver_type_name": "",
      "records": [
        {
          "tracking_code": "F515",
          "tracking_name": "Packed in Domestic Sorting Centre",
          "description": "Pesanan telah disortir di Kota Tegal, Tegal DC.",
          "display_flag": 1,
          "actual_time": 1744734605,
          "operator": "",
          "operator_phone": "",
          "reason_code": "R00",
          "reason_desc": "R00",
          "epod": "",
          "pin_code": "",
          "current_location": {
            "location_name": "Tegal DC",
            "location_type_name": "",
            "lng": "109.130270",
            "lat": "-6.862804",
            "full_address": "ID JAWA TENGAH KOTA TEGAL TEGAL BARAT  Jl. Mataram No.10, RT.003/RW.002, Muarareja, Kec. Tegal Barat, Kota Tegal, Jawa Tengah"
          },
          "next_location": {
            "location_name": "Kebumen DC",
            "location_type_name": "",
            "lng": "109.591656",
            "lat": "-7.651529",
            "full_address": "ID JAWA TENGAH KAB. KEBUMEN PREMBUN  Pagedangan, Karanggedang, Sruweng, Kebumen Regency, Central Java"
          },
          "display_flag_v2": 13,
          "buyer_description": "Pesanan telah disortir di Kota Tegal, Tegal DC.",
          "seller_description": "Pesanan telah disortir di Kota Tegal, Tegal DC.",
          "milestone_code": 5,
          "milestone_name": "In transit"
        },
        // ... data tracking lainnya
      ]
    },
    "is_instant_order": false,
    "is_shopee_market_order": true
  }
}
```

### Response Error

```json
{
  "success": false,
  "message": "Parameter tracking_number diperlukan"
}
```

atau

```json
{
  "success": false,
  "message": "ShopeeXpress API error: 404"
}
```

## Contoh Penggunaan

### Dengan cURL

```bash
curl 'http://localhost:3000/api/tracking?tracking_number=SPXID055128932124'
```

### Dengan JavaScript Fetch

```javascript
fetch('http://localhost:3000/api/tracking?tracking_number=SPXID055128932124')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
``` 