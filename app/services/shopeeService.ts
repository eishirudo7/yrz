/**
 * Shopee Service - Re-export from modular structure
 * 
 * This file re-exports all functions from the modular shopee/ folder
 * to maintain backward compatibility with existing imports.
 * 
 * The actual implementations are now in individual domain modules:
 * - ./shopee/shop.ts - Shop info, auth, performance
 * - ./shopee/orders.ts - Order operations
 * - ./shopee/bookings.ts - Booking operations
 * - ./shopee/logistics.ts - Shipping document operations
 * - ./shopee/products.ts - Product operations
 * - ./shopee/discounts.ts - Discount operations
 * - ./shopee/chat.ts - Messaging operations
 */

export * from './shopee';