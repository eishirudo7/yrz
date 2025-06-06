import { supabase } from '@/lib/supabase';
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

  export async function trackingUpdate(data: any): Promise<void> {
    try {
      const shopId = data.shop_id;
      const orderSn = data.data.ordersn;
      const trackingNo = data.data.tracking_no;
      const packageNumber = data.data.package_number;
      
      console.log(`Menerima pembaruan pelacakan: OrderSN: ${orderSn}, Nomor Pelacakan: ${trackingNo}`);
      
      // Cek apakah nomor pesanan (order_sn) tersedia di tabel 'orders'
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('order_sn,order_status')
          .eq('order_sn', orderSn)
          .single();
  
        if (orderError) throw orderError;
  
        if (orderData) {
          let document_status = 'PENDING'; // Deklarasikan variabel dengan nilai default

          if (orderData.order_status === 'PROCESSED') {
            try {
              const orderList = [{
                order_sn: orderSn,
                package_number: packageNumber,
                tracking_number: trackingNo
              }];
              const documentResult = await createShippingDocument(shopId, orderList);
              
              // Periksa apakah pembuatan dokumen berhasil
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
            // Update tracking information di tabel orders saja
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

      // Update status dokumen hanya di tabel orders
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

  export async function saveEscrowDetail(shopId: number, responseData: any): Promise<void> {
    try {
      // Pastikan data valid
      if (!responseData || !responseData.order_sn) {
        throw new Error('Data escrow tidak valid');
      }
      
      // Ekstrak data dari order_income
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
    
    // Proses setiap pesanan dalam array
    await Promise.all(orderList.map(async (orderData) => {
      try {
        // Pastikan data valid
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
