export type OrderStatus = "READY_TO_SHIP" | "PROCESSED" | "SHIPPED" | "CANCELLED" | "IN_CANCEL" | "TO_RETURN";

export interface Order {
  order_sn: string;
  order_status: string;
  order_time?: number;
  shop_name?: string;
  recipient_name?: string;
  shipping_carrier?: string;
  payment_method?: string;
  document_status?: string;
  is_printed?: boolean;
  cod?: boolean;
  items?: OrderItem[];
  total_belanja?: number;
}

export interface OrderItem {
  model_quantity_purchased: number;
  model_discounted_price: number;
  model_name: string;
  item_sku: string;
} 