/**
 * Order Utilities - Helper functions for orders page
 */

import type { Order } from '@/app/hooks/useOrders'

/**
 * Format order date for display
 */
export function formatDate(order: Order): string {
    const timestamp = order.cod ? order.create_time : (order.pay_time || order.create_time);
    return new Date(timestamp * 1000).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Check if an order is a "fake order" based on quantity and escrow amount
 */
export function isFakeOrder(order: Order): boolean {
    if (order.order_status === 'CANCELLED') return false;
    if (!order.sku_qty) return false;

    const skuEntries = order.sku_qty.split(',').map(entry => entry.trim());
    let totalQuantity = 0;

    skuEntries.forEach(entry => {
        const match = entry.match(/(.*?)\s*\((\d+)\)/);
        if (match) {
            const [, , quantityStr] = match;
            totalQuantity += parseInt(quantityStr);
        }
    });

    return totalQuantity > 1 &&
        order.escrow_amount_after_adjustment !== undefined &&
        order.escrow_amount_after_adjustment !== null &&
        order.escrow_amount_after_adjustment < 100000;
}

/**
 * Order statistics result type
 */
export interface OrderStats {
    pending: number;
    process: number;
    shipping: number;
    cancel: number;
    total: number;
    failed: number;
    completed: number;
    confirm: number;
    return: number;
    fake: number;
}

/**
 * Calculate order statistics from order list
 */
export function calculateOrderStats(orders: Order[]): OrderStats {
    return orders.reduce((acc, order) => {
        if (isFakeOrder(order)) {
            acc.fake++;
            return acc;
        }

        if (order.cancel_reason === 'Failed Delivery') {
            acc.failed++;
        } else {
            switch (order.order_status) {
                case 'UNPAID':
                    acc.pending++;
                    break;
                case 'READY_TO_SHIP':
                    acc.process++;
                    acc.total++;
                    break;
                case 'PROCESSED':
                    acc.process++;
                    acc.total++;
                    break;
                case 'SHIPPED':
                    acc.shipping++;
                    acc.total++;
                    break;
                case 'COMPLETED':
                    if (order.escrow_amount_after_adjustment !== undefined &&
                        order.escrow_amount_after_adjustment !== null &&
                        order.escrow_amount_after_adjustment < 0) {
                        acc.return++;
                    } else {
                        acc.completed++;
                        acc.total++;
                    }
                    break;
                case 'IN_CANCEL':
                    acc.total++;
                    break;
                case 'TO_CONFIRM_RECEIVE':
                    acc.confirm++;
                    acc.total++;
                    break;
                case 'TO_RETURN':
                    acc.return++;
                    break;
                case 'CANCELLED':
                    acc.cancel++;
                    break;
            }
        }
        return acc;
    }, {
        pending: 0,
        process: 0,
        shipping: 0,
        cancel: 0,
        total: 0,
        failed: 0,
        completed: 0,
        confirm: 0,
        return: 0,
        fake: 0
    });
}

// SKU Summary interface
export interface SkuSummary {
    sku_name: string;
    quantity: number;
    total_amount: number;
}

// Shop Summary interface
export interface ShopSummary {
    name: string;
    totalOrders: number;
    totalAmount: number;
    pendingOrders: number;
    processOrders: number;
    shippingOrders: number;
    cancelledOrders: number;
    failedOrders: number;
    topSkus: SkuSummary[];
}

/**
 * Calculate shops summary from orders
 */
export function getShopsSummary(orders: Order[]): ShopSummary[] {
    const summary = orders.reduce((acc: { [key: string]: ShopSummary }, order) => {
        if (!['PROCESSED', 'SHIPPED', 'COMPLETED', 'IN_CANCEL', 'TO_CONFIRM_RECEIVE', 'TO_RETURN'].includes(order.order_status)) {
            return acc;
        }

        if (!acc[order.shop_name]) {
            acc[order.shop_name] = {
                name: order.shop_name,
                totalOrders: 0,
                totalAmount: 0,
                pendingOrders: 0,
                processOrders: 0,
                shippingOrders: 0,
                cancelledOrders: 0,
                failedOrders: 0,
                topSkus: []
            };
        }

        const shop = acc[order.shop_name];
        shop.totalOrders++;
        shop.totalAmount += parseFloat(order.total_amount);

        if (order.sku_qty) {
            const skuEntries = order.sku_qty.split(',').map(entry => entry.trim());

            skuEntries.forEach(entry => {
                const match = entry.match(/(.*?)\s*\((\d+)\)/);
                if (match) {
                    const [, skuName, quantityStr] = match;
                    const quantity = parseInt(quantityStr);
                    const estimatedUnitAmount = parseFloat(order.total_amount) / skuEntries.length / quantity;
                    const normalizedSkuName = skuName.toLowerCase();

                    const existingSku = shop.topSkus.find(sku => sku.sku_name.toLowerCase() === normalizedSkuName);
                    if (existingSku) {
                        existingSku.quantity += quantity;
                        existingSku.total_amount += estimatedUnitAmount * quantity;
                    } else {
                        shop.topSkus.push({
                            sku_name: normalizedSkuName,
                            quantity: quantity,
                            total_amount: estimatedUnitAmount * quantity
                        });
                    }
                }
            });
        }

        return acc;
    }, {});

    Object.values(summary).forEach(shop => {
        shop.topSkus.sort((a, b) => b.quantity - a.quantity);
        shop.topSkus = shop.topSkus.slice(0, 5);
    });

    return Object.values(summary).sort((a, b) => b.totalOrders - a.totalOrders);
}

/**
 * Get all top SKUs across all shops
 */
export function getAllTopSkus(orders: Order[]): SkuSummary[] {
    const allSkus: { [key: string]: SkuSummary } = {};
    const shopsSummary = getShopsSummary(orders);

    shopsSummary.forEach(shop => {
        shop.topSkus.forEach(sku => {
            if (allSkus[sku.sku_name]) {
                allSkus[sku.sku_name].quantity += sku.quantity;
                allSkus[sku.sku_name].total_amount += sku.total_amount;
            } else {
                allSkus[sku.sku_name] = { ...sku };
            }
        });
    });

    return Object.values(allSkus)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
}
