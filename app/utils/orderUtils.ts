import { Order } from "@/app/hooks/useDashboard";
import { OrderItem } from "@/app/hooks/useDashboard";

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta' // Pastikan selalu menggunakan timezone Jakarta
  });
}

export function isToday(timestamp: number): boolean {
  if (!timestamp || timestamp === 0) return false;
  
  // Konversi timestamp UTC ke WIB
  const jakartaTimestamp = timestamp + (7 * 60 * 60);
  const shipDate = new Date(jakartaTimestamp * 1000);
  
  // Dapatkan tanggal sekarang dalam WIB
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  
  return shipDate.getDate() === jakartaNow.getDate() &&
         shipDate.getMonth() === jakartaNow.getMonth() &&
         shipDate.getFullYear() === jakartaNow.getFullYear();
}

export function isOverdue(timestamp: number): boolean {
  if (!timestamp || timestamp === 0) return false;
  
  // Bandingkan timestamp UTC dengan waktu sekarang dalam UTC
  const nowUtc = Math.floor(Date.now() / 1000);
  return timestamp < nowUtc;
}

export function calculateOrderTotal(order: Order): number {
  return order.items?.reduce((total, item) => {
    return total + (item.model_discounted_price * item.model_quantity_purchased);
  }, 0) || 0;
}

export interface GroupedItems {
  [sku: string]: OrderItem[];
}

export function groupItemsBySku(items: OrderItem[] | undefined): GroupedItems {
  if (!items) return {};
  
  return items.reduce((groups: GroupedItems, item) => {
    const sku = item.item_sku;
    if (!groups[sku]) {
      groups[sku] = [];
    }
    groups[sku].push(item);
    return groups;
  }, {});
}

export function getSkuSummary(items: OrderItem[] | undefined): string {
  if (!items || items.length === 0) return '';
  
  const grouped = groupItemsBySku(items);
  return Object.entries(grouped)
    .map(([sku, items]) => {
      const totalQty = items.reduce((sum, item) => sum + item.model_quantity_purchased, 0);
      return `${sku} (${totalQty})`;
    })
    .join(', ');
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
} 