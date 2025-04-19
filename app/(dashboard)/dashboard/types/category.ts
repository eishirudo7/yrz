import { OrderStatus } from '../components/order/StatusComponents';

export interface Category {
  name: string;
  status: OrderStatus;
  count?: number;
}

export const CATEGORY_LIST: Category[] = [
  { name: "Semua", status: "READY_TO_SHIP" },
  { name: "Siap Kirim", status: "READY_TO_SHIP" },
  { name: "Diproses", status: "PROCESSED" },
  { name: "Dikirim", status: "SHIPPED" },
  { name: "Dibatalkan", status: "CANCELLED" },
  { name: "Permintaan Batal", status: "IN_CANCEL" },
  { name: "Retur", status: "TO_RETURN" }
]; 