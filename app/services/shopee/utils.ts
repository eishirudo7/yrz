/**
 * Shopee Service - Shared Utilities
 */

export const RETRY_DELAY = 2000;

/**
 * Retry operation with exponential backoff
 */
export async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T> {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }

    throw lastError;
}

// Shared types
export interface OrderListOptions {
    timeRangeField?: 'create_time' | 'update_time';
    startTime?: number;
    endTime?: number;
    orderStatus?: 'UNPAID' | 'READY_TO_SHIP' | 'PROCESSED' | 'SHIPPED' | 'COMPLETED' | 'IN_CANCEL' | 'CANCELLED' | 'ALL';
    pageSize?: number;
    cursor?: string;
}

export interface BookingListOptions {
    timeRangeField?: 'create_time' | 'update_time';
    startTime?: number;
    endTime?: number;
    bookingStatus?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'ALL';
    pageSize?: number;
    cursor?: string;
}
