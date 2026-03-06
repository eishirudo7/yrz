/**
 * Database Operations — Barrel File
 * 
 * Re-exports semua database operations dari sub-modules.
 * Import dari file ini: import { ... } from '@/app/services/databaseOperations'
 */

// Helpers
export { withRetry } from './db/helpers';

// Order operations (orders, order_items, logistic)
export {
  upsertOrderData,
  upsertOrderItems,
  upsertLogisticData,
  updateOrderStatusOnly,
  trackingUpdate,
  updateDocumentStatus,
  updateOrderTrackingNumber,
  updateOrderDocumentStatusReady,
  getOrderPrintStatus,
  fetchDashboardOrders,
  fetchOrderItemsBatch,
  searchOrders,
  fetchOrderItemsByOrderSn,
  fetchOrderItemsByOrderSns,
  markOrdersAsPrinted,
} from './db/orderOperations';

// Escrow operations
export {
  saveEscrowDetail,
  saveBatchEscrowDetail,
} from './db/escrowOperations';

// Booking operations
export {
  upsertBookingOrders,
  queryBookingOrders,
  searchBookingOrdersDB,
  updateBookingOrderDB,
  updateBookingOrderForWebhookDB,
  markBookingDocumentsAsPrinted,
  deleteBookingOrdersDB,
} from './db/bookingOperations';
export type { BookingOrderData } from './db/bookingOperations';

// Notification operations
export {
  insertNotification,
  updateNotificationProcessed,
  markNotificationsAsRead,
  fetchNotifications,
} from './db/notificationOperations';

// Shop operations (shopee_tokens, items)
export {
  getShopInfoFromDB,
  getAllShopsFromDB,
  updateShopName,
  getShopNameFromDB,
  getUserIdByShopId,
  getItemsBySku,
  getItemsByShopIds,
  upsertItem,
} from './db/shopOperations';

// User operations (keluhan, perubahan_pesanan)
export {
  fetchKeluhanByUserId,
  fetchKeluhanByShopIds,
  updateKeluhanStatus,
  deleteKeluhan,
  fetchPerubahanPesananByUserId,
  fetchPerubahanPesananByShopIds,
  updatePerubahanPesananStatus,
  deletePerubahanPesanan,
} from './db/userOperations';
