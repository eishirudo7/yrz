/**
 * Booking Service
 * 
 * Business logic untuk booking orders.
 * Semua database operations sudah dipindahkan ke db/bookingOperations.ts
 */
import {
  upsertBookingOrders,
  queryBookingOrders,
  searchBookingOrdersDB,
  updateBookingOrderDB,
  updateBookingOrderForWebhookDB,
  markBookingDocumentsAsPrinted,
  deleteBookingOrdersDB,
} from '@/app/services/databaseOperations';
import type { BookingOrderData } from '@/app/services/databaseOperations';

// Re-export database operations dengan nama asli untuk backward compatibility
export const saveBookingOrders = upsertBookingOrders;
export const getBookingOrdersFromDB = queryBookingOrders;
export const deleteBookingOrders = deleteBookingOrdersDB;
export const updateBookingOrder = updateBookingOrderDB;
export const searchBookingOrders = searchBookingOrdersDB;
export const markDocumentsAsPrinted = markBookingDocumentsAsPrinted;

export function updateTrackingNumber(
  shopId: number,
  bookingSn: string,
  trackingNumber: string
) {
  return updateBookingOrderDB(shopId, bookingSn, {
    tracking_number: trackingNumber
  });
}

export function updateTrackingNumberForWebhook(
  shopId: number,
  bookingSn: string,
  trackingNumber: string
) {
  return updateBookingOrderForWebhookDB(shopId, bookingSn, {
    tracking_number: trackingNumber
  });
}

export function updateBookingOrderForWebhook(
  shopId: number,
  bookingSn: string,
  updateData: Partial<BookingOrderData>
) {
  return updateBookingOrderForWebhookDB(shopId, bookingSn, updateData);
}

export function getBookingsReadyToPrint(shopId: number) {
  return queryBookingOrders(shopId, {
    is_printed: false,
    document_status: 'READY'
  });
}