/**
 * Database operations untuk orders, order_items, dan logistic
 */
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { withRetry } from './helpers';
import { createShippingDocument } from '@/app/services/shopeeService';

// ============================================================
// ORDER UPSERT / UPDATE
// ============================================================

export async function upsertOrderData(orderData: any, shopId: number): Promise<void> {
    const orderInsertData = {
        shop_id: shopId,
        order_sn: orderData.order_sn,
        buyer_user_id: orderData.buyer_user_id,
        buyer_username: orderData.buyer_username,
        create_time: orderData.create_time,
        pay_time: orderData.pay_time || orderData.create_time,
        order_status: orderData.order_status,
        currency: orderData.currency,
        total_amount: orderData.total_amount,
        shipping_carrier: orderData.shipping_carrier,
        estimated_shipping_fee: orderData.estimated_shipping_fee,
        actual_shipping_fee_confirmed: orderData.actual_shipping_fee_confirmed,
        cod: orderData.cod,
        days_to_ship: orderData.days_to_ship,
        ship_by_date: orderData.ship_by_date,
        payment_method: orderData.payment_method,
        fulfillment_flag: orderData.fulfillment_flag,
        message_to_seller: orderData.message_to_seller,
        note: orderData.note,
        note_update_time: orderData.note_update_time,
        order_chargeable_weight_gram: orderData.order_chargeable_weight_gram,
        pickup_done_time: orderData.pickup_done_time,
        update_time: orderData.update_time,
        cancel_by: orderData.cancel_by,
        cancel_reason: orderData.cancel_reason,
    };

    await withRetry(async () => {
        const { error } = await supabase
            .from('orders')
            .upsert(orderInsertData);

        if (error) {
            throw new Error(`Gagal menyimpan data pesanan: ${error.message}`);
        }

        console.log(`Data pesanan berhasil disimpan untuk order_sn: ${orderData.order_sn} status: ${orderData.order_status}`);
    });
}

export async function upsertOrderItems(orderData: any): Promise<void> {
    for (const item of orderData.item_list) {
        const itemData = {
            order_sn: orderData.order_sn,
            order_item_id: item.order_item_id,
            item_id: item.item_id,
            item_name: item.item_name,
            item_sku: item.item_sku,
            model_id: item.model_id,
            model_name: item.model_name,
            model_sku: item.model_sku,
            model_quantity_purchased: item.model_quantity_purchased,
            model_original_price: item.model_original_price,
            model_discounted_price: item.model_discounted_price,
            wholesale: item.wholesale,
            weight: item.weight,
            add_on_deal: item.add_on_deal,
            main_item: item.main_item,
            add_on_deal_id: item.add_on_deal_id,
            promotion_type: item.promotion_type,
            promotion_id: item.promotion_id,
            promotion_group_id: item.promotion_group_id,
            image_url: item.image_info.image_url
        };

        await withRetry(async () => {
            const { error } = await supabase
                .from('order_items')
                .upsert(itemData, { onConflict: 'order_sn,order_item_id,model_id' });

            if (error) {
                throw new Error(`Gagal menyimpan data item pesanan: ${error.message}`);
            }
        });
    }
}

export async function upsertLogisticData(orderData: any, shopId: number): Promise<void> {
    for (const pkg of orderData.package_list) {
        const logisticData = {
            order_sn: orderData.order_sn,
            package_number: pkg.package_number,
            logistics_status: pkg.logistics_status,
            shipping_carrier: pkg.shipping_carrier,
            parcel_chargeable_weight_gram: pkg.parcel_chargeable_weight_gram,
            recipient_name: orderData.recipient_address.name,
            recipient_phone: orderData.recipient_address.phone,
            recipient_town: orderData.recipient_address.town,
            recipient_district: orderData.recipient_address.district,
            recipient_city: orderData.recipient_address.city,
            recipient_state: orderData.recipient_address.state,
            recipient_region: orderData.recipient_address.region,
            recipient_zipcode: orderData.recipient_address.zipcode,
            recipient_full_address: orderData.recipient_address.full_address,
        };

        await withRetry(async () => {
            const { error } = await supabase
                .from('logistic')
                .upsert(logisticData);

            if (error) {
                throw new Error(`Gagal menyimpan data logistik: ${error.message}`);
            }
        });
    }
}

export async function updateOrderStatusOnly(orderSn: string, status: string, updateTime: number): Promise<void> {
    await withRetry(async () => {
        const { error } = await supabase
            .from('orders')
            .update({
                order_status: status,
                update_time: updateTime
            })
            .eq('order_sn', orderSn);

        if (error) {
            throw new Error(`Gagal memperbarui status pesanan: ${error.message}`);
        }

        console.log(`Status pesanan berhasil diperbarui untuk order_sn: ${orderSn} ke status: ${status}`);
    });
}

// ============================================================
// TRACKING & DOCUMENT STATUS
// ============================================================

export async function trackingUpdate(data: any): Promise<void> {
    try {
        const shopId = data.shop_id;
        const orderSn = data.data.ordersn;
        const trackingNo = data.data.tracking_no;
        const packageNumber = data.data.package_number;

        console.log(`Menerima pembaruan pelacakan: OrderSN: ${orderSn}, Nomor Pelacakan: ${trackingNo}`);

        try {
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('order_sn,order_status')
                .eq('order_sn', orderSn)
                .single();

            if (orderError) throw orderError;

            if (orderData) {
                let document_status = 'PENDING';

                if (orderData.order_status === 'PROCESSED') {
                    try {
                        const orderList = [{
                            order_sn: orderSn,
                            package_number: packageNumber,
                            tracking_number: trackingNo
                        }];
                        const documentResult = await createShippingDocument(shopId, orderList);

                        if (documentResult.error === "") {
                            document_status = 'READY';
                        } else {
                            document_status = 'FAILED';
                        }
                    } catch (error) {
                        console.error('Gagal membuat dokumen pengiriman:', error);
                        document_status = 'FAILED';
                    }
                }

                console.log(`OrderSN ${orderSn} ditemukan di tabel orders`);

                try {
                    const { data: updatedOrder, error: updateError } = await supabase
                        .from('orders')
                        .update({
                            tracking_number: trackingNo,
                            document_status: document_status,
                        })
                        .eq('order_sn', orderSn);

                    if (updateError) {
                        throw new Error(`Gagal memperbarui nomor pelacakan: ${updateError.message}`);
                    }

                    console.log(`Nomor pelacakan berhasil diperbarui untuk OrderSN: ${orderSn}`);
                } catch (error) {
                    console.error('Gagal memperbarui nomor pelacakan di orders:', error);
                }
            } else {
                console.warn(`OrderSN ${orderSn} tidak ditemukan di tabel orders`);
            }
        } catch (error) {
            console.error('Gagal memeriksa OrderSN di tabel orders:', error);
        }
    } catch (error) {
        console.error('Terjadi kesalahan saat menangani callback pesanan:', error);
    }
}

export async function updateDocumentStatus(orderSn: string): Promise<void> {
    try {
        console.log(`Memperbarui status dokumen: OrderSN: ${orderSn}`);

        const { error } = await supabase
            .from('orders')
            .update({
                document_status: 'READY',
            })
            .eq('order_sn', orderSn);

        if (error) {
            throw new Error(`Gagal memperbarui status dokumen: ${error.message}`);
        }

        console.log(`Status dokumen berhasil diperbarui untuk OrderSN: ${orderSn}`);
    } catch (error) {
        console.error('Error dalam updateDocumentStatus:', error);
        throw error;
    }
}

export async function updateOrderTrackingNumber(orderSn: string, trackingNumber: string): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ tracking_number: trackingNumber })
        .eq('order_sn', orderSn);

    if (error) {
        console.error('Gagal mengupdate tracking number di database:', error);
        throw error;
    }
}

export async function updateOrderDocumentStatusReady(orderSn: string): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ document_status: 'READY' })
        .eq('order_sn', orderSn);

    if (error) {
        console.error('Gagal mengupdate status dokumen:', error);
        throw error;
    }
}

// ============================================================
// ORDER QUERIES (READ)
// ============================================================

export async function getOrderPrintStatus(orderSn: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('is_printed')
            .eq('order_sn', orderSn)
            .single();

        if (error) throw error;
        return data?.is_printed || false;
    } catch (error) {
        console.error(`Error checking print status for order ${orderSn}:`, error);
        return false;
    }
}

export async function fetchDashboardOrders(
    shopIds: number[],
    startTimestamp: number,
    endTimestamp: number
) {
    const supabaseClient = await createClient();

    const fetchPaginatedOrders = async (queryBuilder: any, pageSize: number = 800) => {
        let allData: any[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await queryBuilder.range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                page++;
                hasMore = data.length === pageSize;
            } else {
                hasMore = false;
            }
        }

        return allData;
    };

    const selectFields = `
    order_sn, shop_id, order_status, buyer_user_id, create_time, update_time, pay_time, buyer_username,
    escrow_amount_after_adjustment, shipping_carrier, cod, tracking_number, document_status, is_printed,
    ship_by_date, days_to_ship
  `;

    const normalOrdersQuery = supabaseClient
        .from('orders')
        .select(selectFields)
        .in('shop_id', shopIds)
        .in('order_status', ['READY_TO_SHIP', 'PROCESSED', 'IN_CANCEL', 'TO_RETURN'])
        .order('pay_time', { ascending: false });

    const cancelledOrdersQuery = supabaseClient
        .from('orders')
        .select(selectFields)
        .in('shop_id', shopIds)
        .eq('order_status', 'CANCELLED')
        .gte('pay_time', startTimestamp)
        .lte('pay_time', endTimestamp)
        .order('pay_time', { ascending: false });

    const shippedOrdersQuery = supabaseClient
        .from('orders')
        .select(`
      order_sn, shop_id, order_status, buyer_user_id, create_time, update_time, pay_time, buyer_username,
      escrow_amount_after_adjustment, shipping_carrier, cod, tracking_number, document_status, is_printed
    `)
        .in('shop_id', shopIds)
        .eq('order_status', 'SHIPPED')
        .gte('pickup_done_time', startTimestamp)
        .lte('pickup_done_time', endTimestamp)
        .order('pickup_done_time', { ascending: false });

    const [normalOrdersData, cancelledOrdersData, shippedOrdersData] = await Promise.all([
        fetchPaginatedOrders(normalOrdersQuery),
        fetchPaginatedOrders(cancelledOrdersQuery),
        fetchPaginatedOrders(shippedOrdersQuery)
    ]);

    return [
        ...(normalOrdersData || []),
        ...(cancelledOrdersData || []),
        ...(shippedOrdersData || [])
    ];
}

export async function fetchOrderItemsBatch(orderSns: string[]) {
    const batchSize = 500;

    interface OrderItem {
        order_sn: string;
        model_quantity_purchased: string | number;
        model_discounted_price: string | number;
        item_sku: string;
        model_name: string;
    }

    let allOrderItemsData: OrderItem[] = [];

    for (let i = 0; i < orderSns.length; i += batchSize) {
        const batchOrderSns = orderSns.slice(i, i + batchSize);
        const { data: itemsBatchData, error: itemsBatchError } = await supabase
            .from('order_items')
            .select('order_sn, model_quantity_purchased, model_discounted_price, item_sku, model_name')
            .in('order_sn', batchOrderSns);

        if (itemsBatchError) {
            console.error(`Gagal mengambil batch order items ${i}:`, itemsBatchError);
            continue;
        }

        if (itemsBatchData) {
            allOrderItemsData = [...allOrderItemsData, ...itemsBatchData];
        }
    }

    return allOrderItemsData;
}

// ============================================================
// ORDER SEARCH
// ============================================================

export async function searchOrders(
    shopIds: number[],
    filters: { order_sn?: string; buyer_username?: string; tracking_number?: string }
): Promise<any[]> {
    let query = supabase
        .from('orders')
        .select('*')
        .in('shop_id', shopIds);

    if (filters.order_sn) query = query.ilike('order_sn', `%${filters.order_sn}%`);
    if (filters.buyer_username) query = query.ilike('buyer_username', `%${filters.buyer_username}%`);
    if (filters.tracking_number) query = query.ilike('tracking_number', `%${filters.tracking_number}%`);

    const { data, error } = await query.order('create_time', { ascending: false });
    if (error) throw new Error(`Error searching orders: ${error.message}`);
    return data || [];
}

export async function fetchOrderItemsByOrderSn(orderSn: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('order_items')
        .select('model_quantity_purchased, model_discounted_price, item_sku, model_name')
        .eq('order_sn', orderSn);

    if (error) throw new Error(`Error fetching order items: ${error.message}`);
    return data || [];
}

export async function fetchOrderItemsByOrderSns(orderSns: string[]): Promise<any[]> {
    const { data, error } = await supabase
        .from('order_items')
        .select('order_sn, item_sku, model_sku, model_quantity_purchased, model_discounted_price')
        .in('order_sn', orderSns);

    if (error) throw new Error(`Error fetching order items: ${error.message}`);
    return data || [];
}

export async function markOrdersAsPrinted(orderSns: string[]): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ is_printed: true })
        .in('order_sn', orderSns);

    if (error) throw new Error(`Error marking orders as printed: ${error.message}`);
}
