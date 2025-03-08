import { useState, useEffect } from 'react';
import axios from 'axios';

interface OrderItem {
  item_id: number;
  item_sku: string;
  model_id: number;
  image_url: string;
  item_name: string;
  model_sku: string;
  model_name: string;
  order_item_id: number;
  model_original_price: number;
  model_discounted_price: number;
  model_quantity_purchased: number;
}

interface Order {
  order_sn: string;
  buyer_user_id: number;
  create_time: number;
  estimated_shipping_fee: number;
  actual_shipping_fee_confirmed: boolean;
  cod: boolean;
  days_to_ship: number;
  ship_by_date: number;
  payment_method: string;
  fulfillment_flag: string;
  message_to_seller: string;
  note: string;
  note_update_time: number;
  order_chargeable_weight_gram: number;
  pickup_done_time: number;
  cancel_by: string;
  shipping_carrier_info: string;
  shop_id: number;
  shop_name: string;
  buyer_username: string;
  pay_time: number;
  total_amount: number;
  shipping_carrier: string;
  tracking_number: string;
  order_status: string;
  order_items: OrderItem[];
  total_belanja: number;
  cancel_reason?: string;
}

export function OrderDetails(userId: string | number, isOpen: boolean) {
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrderHistory = async () => {
      if (!userId || !isOpen) {
        setOrderHistory([]);
        return;
      }
      
      setIsLoading(true);
      setError(null);

      try {
        const response = await axios.get(`/api/order_details?user_id=${userId}`);
        setOrderHistory(response.data.data);
      } catch (error) {
        console.error('Error fetching order history:', error);
        setError('Gagal mengambil riwayat pesanan');
        setOrderHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderHistory();
  }, [userId, isOpen]);

  return { orderHistory, isLoading, error };
} 