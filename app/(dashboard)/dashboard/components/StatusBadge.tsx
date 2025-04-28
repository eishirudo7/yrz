import React from 'react';
import { Button } from "@/components/ui/button";
import { Send, CheckCircle, XCircle, Package, Clock, Truck, AlertCircle, RefreshCcw } from 'lucide-react';
import { Order } from '@/app/hooks/useDashboard';
import { OrderStatus } from '../types';

interface StatusBadgeProps {
  status: OrderStatus;
  order: Order;
  onProcess: (order: Order) => void;
  onCancellationAction: (orderSn: string, action: 'ACCEPT' | 'REJECT') => void;
}

// Fungsi ini harusnya diimpor dari file utama, tapi kita definisikan ulang disini
const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case "READY_TO_SHIP":
      return "bg-green-600 text-white";
    case "PROCESSED":
      return "bg-blue-600 text-white";
    case "SHIPPED":
      return "bg-indigo-600 text-white";
    case "CANCELLED":
      return "bg-red-600 text-white";
    case "IN_CANCEL":
      return "bg-yellow-600 text-white";
    case "TO_RETURN":
      return "bg-purple-600 text-white";
    default:
      return "bg-gray-600 text-white";
  }
};

// Fungsi ini harusnya diimpor dari file utama, tapi kita definisikan ulang disini
const getStatusIcon = (status: OrderStatus) => {
  switch (status) {
    case "READY_TO_SHIP":
      return <Package size={14} className="inline-block mr-1" />;
    case "PROCESSED":
      return <Clock size={14} className="inline-block mr-1" />;
    case "SHIPPED":
      return <Truck size={14} className="inline-block mr-1" />;
    case "CANCELLED":
      return <XCircle size={14} className="inline-block mr-1" />;
    case "IN_CANCEL":
      return <AlertCircle size={14} className="inline-block mr-1" />;
    case "TO_RETURN":
      return <RefreshCcw size={14} className="inline-block mr-1" />;
    default:
      return null;
  }
};

// Implementasi persis sama dengan StatusBadge di TableOrderAsli.tsx
export const StatusBadge = React.memo(({ status, order, onProcess, onCancellationAction }: StatusBadgeProps) => (
  <div className="flex items-center gap-2">
    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      {status}
    </span>
    {status === 'READY_TO_SHIP' && (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
        onClick={() => onProcess(order)}
        title="Proses Pesanan"
      >
        <Send size={16} className="text-blue-600 dark:text-blue-400" />
      </Button>
    )}
    {status === 'IN_CANCEL' && (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
          onClick={() => onCancellationAction(order.order_sn, 'ACCEPT')}
          title="Terima Pembatalan"
        >
          <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
          onClick={() => onCancellationAction(order.order_sn, 'REJECT')}
          title="Tolak Pembatalan"
        >
          <XCircle size={16} className="text-red-600 dark:text-red-400" />
        </Button>
      </div>
    )}
  </div>
));

StatusBadge.displayName = 'StatusBadge'; 