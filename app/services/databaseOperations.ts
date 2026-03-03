import { db } from '@/db';
import { orders, orderItems, logistic, orderEscrow } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createShippingDocument } from '@/app/services/shopeeService';

// Tambahkan fungsi helper untuk retry
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      // Log sukses setelah retry
      if (attempt > 1) {
        console.log(`Berhasil setelah percobaan ke-${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        console.error(`Gagal setelah ${maxRetries} percobaan:`, error);
        break;
      }

      const nextDelay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`Percobaan ke-${attempt} gagal, mencoba lagi dalam ${nextDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, nextDelay));
    }
  }

  throw lastError;
}

export async function upsertOrderData(orderData: any, shopId: number): Promise<void> {
  const orderInsertData = {
    orderSn: orderData.order_sn,
    shopId: shopId,
    buyerUserId: orderData.buyer_user_id,
    buyerUsername: orderData.buyer_username,
    createTime: orderData.create_time,
    payTime: orderData.pay_time || orderData.create_time,
    orderStatus: orderData.order_status,
    currency: orderData.currency,
    totalAmount: String(orderData.total_amount),
    shippingCarrier: orderData.shipping_carrier,
    estimatedShippingFee: orderData.estimated_shipping_fee != null ? String(orderData.estimated_shipping_fee) : null,
    actualShippingFeeConfirmed: orderData.actual_shipping_fee_confirmed,
    cod: orderData.cod,
    daysToShip: orderData.days_to_ship,
    shipByDate: orderData.ship_by_date,
    paymentMethod: orderData.payment_method,
    fulfillmentFlag: orderData.fulfillment_flag,
    messageToSeller: orderData.message_to_seller,
    note: orderData.note,
    noteUpdateTime: orderData.note_update_time,
    orderChargeableWeightGram: orderData.order_chargeable_weight_gram,
    pickupDoneTime: orderData.pickup_done_time,
    updateTime: orderData.update_time,
    cancelBy: orderData.cancel_by,
    cancelReason: orderData.cancel_reason,
  };

  await withRetry(async () => {
    await db.insert(orders)
      .values(orderInsertData)
      .onConflictDoUpdate({
        target: orders.orderSn,
        set: orderInsertData,
      });

    console.log(`Data pesanan berhasil disimpan untuk order_sn: ${orderData.order_sn} status: ${orderData.order_status}`);
  });
}

export async function upsertOrderItems(orderData: any): Promise<void> {
  for (const item of orderData.item_list) {
    const itemData = {
      orderSn: orderData.order_sn,
      orderItemId: item.order_item_id,
      itemId: item.item_id,
      itemName: item.item_name,
      itemSku: item.item_sku,
      modelId: item.model_id,
      modelName: item.model_name,
      modelSku: item.model_sku,
      modelQuantityPurchased: item.model_quantity_purchased,
      modelOriginalPrice: item.model_original_price != null ? String(item.model_original_price) : null,
      modelDiscountedPrice: item.model_discounted_price != null ? String(item.model_discounted_price) : null,
      wholesale: item.wholesale,
      weight: item.weight != null ? String(item.weight) : null,
      addOnDeal: item.add_on_deal,
      mainItem: item.main_item,
      addOnDealId: item.add_on_deal_id,
      promotionType: item.promotion_type,
      promotionId: item.promotion_id,
      promotionGroupId: item.promotion_group_id,
      imageUrl: item.image_info?.image_url,
    };

    await withRetry(async () => {
      await db.insert(orderItems)
        .values(itemData)
        .onConflictDoUpdate({
          target: [orderItems.orderSn, orderItems.orderItemId, orderItems.modelId],
          set: itemData,
        });
    });
  }
}

export async function upsertLogisticData(orderData: any, shopId: number): Promise<void> {
  for (const pkg of orderData.package_list) {
    const logisticData = {
      orderSn: orderData.order_sn,
      packageNumber: pkg.package_number,
      logisticsStatus: pkg.logistics_status,
      shippingCarrier: pkg.shipping_carrier,
      parcelChargeableWeightGram: pkg.parcel_chargeable_weight_gram,
      recipientName: orderData.recipient_address.name,
      recipientPhone: orderData.recipient_address.phone,
      recipientTown: orderData.recipient_address.town,
      recipientDistrict: orderData.recipient_address.district,
      recipientCity: orderData.recipient_address.city,
      recipientState: orderData.recipient_address.state,
      recipientRegion: orderData.recipient_address.region,
      recipientZipcode: orderData.recipient_address.zipcode,
      recipientFullAddress: orderData.recipient_address.full_address,
    };

    await withRetry(async () => {
      await db.insert(logistic)
        .values(logisticData)
        .onConflictDoUpdate({
          target: [logistic.orderSn, logistic.packageNumber],
          set: logisticData,
        });
    });
  }
}

export async function trackingUpdate(data: any): Promise<void> {
  try {
    const shopId = data.shop_id;
    const orderSn = data.data.ordersn;
    const trackingNo = data.data.tracking_no;
    const packageNumber = data.data.package_number;

    console.log(`Menerima pembaruan pelacakan: OrderSN: ${orderSn}, Nomor Pelacakan: ${trackingNo}`);

    // Cek apakah nomor pesanan (order_sn) tersedia di tabel 'orders'
    try {
      const [orderRow] = await db.select({
        orderSn: orders.orderSn,
        orderStatus: orders.orderStatus,
      })
        .from(orders)
        .where(eq(orders.orderSn, orderSn))
        .limit(1);

      if (orderRow) {
        let document_status = 'PENDING';

        if (orderRow.orderStatus === 'PROCESSED') {
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
          await db.update(orders)
            .set({
              trackingNumber: trackingNo,
              documentStatus: document_status,
            })
            .where(eq(orders.orderSn, orderSn));

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

    await db.update(orders)
      .set({ documentStatus: 'READY' })
      .where(eq(orders.orderSn, orderSn));

    console.log(`Status dokumen berhasil diperbarui untuk OrderSN: ${orderSn}`);
  } catch (error) {
    console.error('Error dalam updateDocumentStatus:', error);
    throw error;
  }
}

export async function updateOrderStatusOnly(orderSn: string, status: string, updateTime: number): Promise<void> {
  await withRetry(async () => {
    await db.update(orders)
      .set({
        orderStatus: status,
        updateTime: updateTime,
      })
      .where(eq(orders.orderSn, orderSn));

    console.log(`Status pesanan berhasil diperbarui untuk order_sn: ${orderSn} ke status: ${status}`);
  });
}

export async function saveEscrowDetail(shopId: number, responseData: any): Promise<void> {
  try {
    if (!responseData || !responseData.order_sn) {
      throw new Error('Data escrow tidak valid');
    }

    const orderIncome = responseData.order_income || {};

    const escrowData = {
      orderSn: responseData.order_sn,
      shopId: shopId,
      escrowAmount: orderIncome.escrow_amount != null ? String(orderIncome.escrow_amount) : null,
      buyerTotalAmount: orderIncome.buyer_total_amount != null ? String(orderIncome.buyer_total_amount) : null,
      originalPrice: orderIncome.original_price != null ? String(orderIncome.original_price) : null,
      sellerDiscount: orderIncome.seller_discount != null ? String(orderIncome.seller_discount) : null,
      shopeeDiscount: orderIncome.shopee_discount != null ? String(orderIncome.shopee_discount) : null,
      voucherFromSeller: orderIncome.voucher_from_seller != null ? String(orderIncome.voucher_from_seller) : null,
      commissionFee: orderIncome.commission_fee != null ? String(orderIncome.commission_fee) : null,
      serviceFee: orderIncome.service_fee != null ? String(orderIncome.service_fee) : null,
      sellerTransactionFee: orderIncome.seller_transaction_fee != null ? String(orderIncome.seller_transaction_fee) : null,
      actualShippingFee: orderIncome.actual_shipping_fee != null ? String(orderIncome.actual_shipping_fee) : null,
      buyerPaymentMethod: orderIncome.buyer_payment_method || null,
      amsCommissionFee: orderIncome.order_ams_commission_fee != null ? String(orderIncome.order_ams_commission_fee) : null,
      updatedAt: new Date(),
      escrowAmountAfterAdjustment: String(orderIncome.escrow_amount_after_adjustment || 0),
    };

    await withRetry(async () => {
      await db.insert(orderEscrow)
        .values(escrowData)
        .onConflictDoUpdate({
          target: orderEscrow.orderSn,
          set: escrowData,
        });

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
