/**
 * Database operations untuk order_escrow
 */
import { supabase } from '@/lib/supabase';
import { withRetry } from './helpers';

export async function saveEscrowDetail(shopId: number, responseData: any): Promise<void> {
    try {
        if (!responseData || !responseData.order_sn) {
            throw new Error('Data escrow tidak valid');
        }

        const orderIncome = responseData.order_income || {};

        const escrowData = {
            order_sn: responseData.order_sn,
            shop_id: shopId,
            escrow_amount: orderIncome.escrow_amount || null,
            buyer_total_amount: orderIncome.buyer_total_amount || null,
            original_price: orderIncome.original_price || null,
            seller_discount: orderIncome.seller_discount || null,
            shopee_discount: orderIncome.shopee_discount || null,
            voucher_from_seller: orderIncome.voucher_from_seller || null,
            commission_fee: orderIncome.commission_fee || null,
            service_fee: orderIncome.service_fee || null,
            seller_transaction_fee: orderIncome.seller_transaction_fee || null,
            actual_shipping_fee: orderIncome.actual_shipping_fee || null,
            buyer_payment_method: orderIncome.buyer_payment_method || null,
            ams_commission_fee: orderIncome.order_ams_commission_fee || null,
            updated_at: new Date().toISOString(),
            escrow_amount_after_adjustment: orderIncome.escrow_amount_after_adjustment || 0
        };

        await withRetry(async () => {
            const { error } = await supabase
                .from('order_escrow')
                .upsert(escrowData, { onConflict: 'order_sn,shop_id' });

            if (error) {
                throw new Error(`Gagal menyimpan detail escrow: ${error.message}`);
            }

            const amsCommissionFee = orderIncome.order_ams_commission_fee || 0;
            const amsInfo = amsCommissionFee > 0 ? ` (AMS Fee: Rp ${amsCommissionFee.toLocaleString('id-ID')})` : '';
            console.log(`Detail escrow berhasil disimpan untuk order_sn: ${responseData.order_sn} dengan total escrow: Rp ${(orderIncome.escrow_amount_after_adjustment || 0).toLocaleString('id-ID')}${amsInfo}`);
        }, 3, 1000);

    } catch (error) {
        console.error('Gagal menyimpan detail escrow:', error);
        throw error;
    }
}

export async function saveBatchEscrowDetail(shopId: number, orderList: any[]): Promise<{ success: number, failed: number, errors: any[] }> {
    if (!orderList || !Array.isArray(orderList) || orderList.length === 0) {
        return { success: 0, failed: 0, errors: [{ message: 'Daftar pesanan kosong atau tidak valid' }] };
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    await Promise.all(orderList.map(async (orderData) => {
        try {
            if (!orderData || !orderData.order_sn) {
                throw new Error(`Data escrow tidak valid untuk salah satu pesanan`);
            }

            await saveEscrowDetail(shopId, orderData);
            successCount++;
        } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({
                order_sn: orderData?.order_sn || 'unknown',
                message: errorMessage
            });
            console.error(`Gagal menyimpan escrow untuk ${orderData?.order_sn || 'unknown'}: ${errorMessage}`);
        }
    }));

    console.log(`Batch escrow save completed. Success: ${successCount}, Failed: ${failedCount}`);
    return { success: successCount, failed: failedCount, errors };
}
