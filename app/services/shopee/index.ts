/**
 * Shopee Service - Main Entry Point (Barrel Export)
 * 
 * This file re-exports all functions from domain modules for backward compatibility.
 * Existing imports like `import { getOrderDetail } from '@/app/services/shopeeService'`
 * will continue to work.
 */

// Utils & Types
export { retryOperation, RETRY_DELAY, type OrderListOptions, type BookingListOptions } from './utils';

// Shop Operations
export {
    getShopInfo,
    getAllShops,
    getRefreshCount,
    generateAuthUrl,
    generateDeauthUrl,
    getShopPerformance,
    getShopPenalty,
    getAdsDailyPerformance,
    blockShopWebhook,
    unblockShopWebhook
} from './shop';

// Order Operations
export {
    getOrderDetail,
    getOrderList,
    getReadyToShipOrders,
    processReadyToShipOrders,
    handleBuyerCancellation,
    cancelOrder,
    getEscrowDetail,
    getEscrowDetailBatch
} from './orders';

// Booking Operations
export {
    getBookingList,
    getBookingDetail,
    getBookingShippingParameter,
    shipBooking,
    getBookingTrackingNumber,
    createBookingShippingDocument,
    downloadBookingShippingDocument
} from './bookings';

// Logistics Operations
export {
    getTrackingNumber,
    createShippingDocument,
    downloadShippingDocument
} from './logistics';

// Product Operations
export {
    getItemList,
    getItemBaseInfo,
    getModelList,
    getItemLimit,
    addItem,
    updateItem,
    deleteItem,
    unlistItems,
    updateStock,
    getItemPromotion,
    getProductComment,
    replyProductComment,
    getReturnList
} from './products';

// Discount Operations
export {
    createDiscount,
    addDiscountItems,
    getDiscountDetails,
    getDiscountList,
    updateDiscount,
    updateDiscountItems,
    deleteDiscount,
    deleteDiscountItems,
    endDiscount
} from './discounts';

// Chat Operations
export {
    getConversationList,
    getOneConversation,
    getMessages,
    sendMessage,
    readConversation
} from './chat';
