# Yorozuya - Shopee Seller Dashboard

Dashboard terintegrasi untuk mengelola toko Shopee dengan fitur multi-shop, order processing, booking management, dan lebih banyak lagi.

## 📚 Dokumentasi

Untuk memahami codebase ini, silakan baca dokumentasi berikut:

### Arsitektur
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Overview arsitektur keseluruhan, layer structure, dan diagram

### Workflows
Dokumentasi step-by-step untuk setiap proses bisnis:

| Workflow | Deskripsi |
|----------|-----------|
| [Order Processing](docs/workflows/order-processing.md) | Alur pemrosesan pesanan hingga pengiriman |
| [Booking Management](docs/workflows/booking-management.md) | Pengelolaan COD booking orders |
| [Token Refresh](docs/workflows/token-refresh.md) | OAuth dan manajemen token Shopee |
| [Data Sync](docs/workflows/data-sync.md) | Sinkronisasi data dari Shopee API |
| [Shipping Document](docs/workflows/shipping-document.md) | Pembuatan dan cetak resi |
| [Chat & Messaging](docs/workflows/chat-messaging.md) | Chat dengan pembeli |
| [Discounts & Promotions](docs/workflows/discounts-promotions.md) | Manajemen diskon dan flash sale |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Redis instance (Upstash recommended)
- Shopee Partner API credentials

### Installation

```bash
# Clone repository
git clone <repo-url>
cd yorozuya

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Shopee
SHOPEE_PARTNER_ID=123456
SHOPEE_PARTNER_KEY=abc123...

# Redis (Upstash)
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
```

---

## 📁 Project Structure

```
yorozuya/
├── app/
│   ├── (auth)/          # Auth pages
│   ├── (dashboard)/     # Dashboard pages (16 pages)
│   ├── api/             # API routes (39 endpoints)
│   ├── hooks/           # Custom hooks (16 hooks)
│   └── services/        # Business logic
├── lib/shopee/          # Shopee API client
├── components/          # UI components
├── contexts/            # React contexts
├── types/               # TypeScript types
└── utils/               # Utilities
```

Untuk detail lengkap, lihat [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis (Upstash)
- **Auth**: Supabase Auth + Shopee OAuth
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui

---

## 📝 License

Private project - All rights reserved.
