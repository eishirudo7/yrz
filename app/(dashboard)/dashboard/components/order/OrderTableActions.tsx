import { Order } from '@/app/hooks/useDashboard';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Printer, CheckSquare, XCircle, RefreshCcw, Loader2, Send, PrinterCheck } from 'lucide-react';
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';
import { toast } from 'sonner';

interface OrderTableActionsProps {
  orders: Order[];
  selectedOrders: string[];
  onBulkPrint: (orders: Order[]) => Promise<void>;
  onBulkAcceptCancellation: (orders: Order[]) => Promise<void>;
  onBulkRejectCancellation: (orders: Order[]) => Promise<void>;
  onSync: () => Promise<void>;
}

interface BulkProgress {
  total: number;
  processed: number;
  currentOperation: 'print' | 'accept' | 'reject' | 'sync';
  currentOrder?: string;
}

export function OrderTableActions({
  orders,
  selectedOrders,
  onBulkPrint,
  onBulkAcceptCancellation,
  onBulkRejectCancellation,
  onSync
}: OrderTableActionsProps) {
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

  // Filter pesanan yang bisa dicetak
  const printableOrders = orders.filter(order => 
    (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL') &&
    order.document_status === 'READY'
  );

  // Filter pesanan yang siap kirim
  const readyToShipOrders = orders.filter(order => 
    order.order_status === 'READY_TO_SHIP'
  );

  // Filter pesanan yang bisa diterima pembatalannya
  const cancellableOrders = orders.filter(order => 
    order.order_status === 'IN_CANCEL'
  );

  // Filter pesanan yang belum dicetak
  const unprintedOrders = orders.filter(order => 
    (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL') &&
    order.document_status === 'READY' &&
    !order.is_printed
  );

  // Handler untuk bulk print
  const handleBulkPrint = async () => {
    setIsPrintDialogOpen(false);
    const ordersToPrint = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.order_sn))
      : printableOrders;

    if (ordersToPrint.length === 0) {
      toast.info('Tidak ada dokumen yang bisa dicetak');
      return;
    }

    setBulkProgress({
      total: ordersToPrint.length,
      processed: 0,
      currentOperation: 'print'
    });

    try {
      await onBulkPrint(ordersToPrint);
    } catch (error) {
      toast.error('Gagal mencetak dokumen');
    } finally {
      setBulkProgress(null);
    }
  };

  // Handler untuk bulk accept cancellation
  const handleBulkAcceptCancellation = async () => {
    setIsAcceptDialogOpen(false);
    const ordersToAccept = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.order_sn))
      : cancellableOrders;

    if (ordersToAccept.length === 0) {
      toast.info('Tidak ada pembatalan yang bisa diterima');
      return;
    }

    setBulkProgress({
      total: ordersToAccept.length,
      processed: 0,
      currentOperation: 'accept'
    });

    try {
      await onBulkAcceptCancellation(ordersToAccept);
    } catch (error) {
      toast.error('Gagal menerima pembatalan');
    } finally {
      setBulkProgress(null);
    }
  };

  // Handler untuk bulk reject cancellation
  const handleBulkRejectCancellation = async () => {
    setIsRejectDialogOpen(false);
    const ordersToReject = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.order_sn))
      : cancellableOrders;

    if (ordersToReject.length === 0) {
      toast.info('Tidak ada pembatalan yang bisa ditolak');
      return;
    }

    setBulkProgress({
      total: ordersToReject.length,
      processed: 0,
      currentOperation: 'reject'
    });

    try {
      await onBulkRejectCancellation(ordersToReject);
    } catch (error) {
      toast.error('Gagal menolak pembatalan');
    } finally {
      setBulkProgress(null);
    }
  };

  // Handler untuk sync
  const handleSync = async () => {
    setBulkProgress({
      total: 1,
      processed: 0,
      currentOperation: 'sync'
    });

    try {
      await onSync();
    } catch (error) {
      toast.error('Gagal melakukan sinkronisasi');
    } finally {
      setBulkProgress(null);
    }
  };

  return (
    <Card className="px-2 py-2 shadow-none rounded-lg">
      <div className="flex justify-between">
        {/* Grup Tombol Pesanan - Sebelah Kiri */}
        <div className="flex gap-2">
          {/* Tombol Proses Semua dengan warna primary */}
          <Button
            onClick={() => setIsAcceptDialogOpen(true)}
            className="px-2 sm:px-3 py-0 h-[32px] text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap flex items-center"
            disabled={readyToShipOrders.length === 0}
          >
            <Send size={14} className="sm:mr-1.5" />
            <span className="hidden sm:inline mr-1">
              Proses Semua
            </span>
            {readyToShipOrders.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                {readyToShipOrders.length}
              </span>
            )}
          </Button>

          {/* Tombol Pembatalan */}
          <Button
            onClick={() => setIsRejectDialogOpen(true)}
            className="px-2 sm:px-3 py-0 h-[32px] text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap flex items-center"
            disabled={cancellableOrders.length === 0}
          >
            <XCircle size={14} className="sm:mr-1.5" />
            <span className="hidden sm:inline mr-1">
              Pembatalan
            </span>
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
              {cancellableOrders.length}
            </span>
          </Button>

          {/* Tombol Sinkronkan */}
          <Button
            onClick={handleSync}
            disabled={bulkProgress?.currentOperation === 'sync'}
            className="px-2 sm:px-3 py-0 h-[32px] text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap flex items-center"
          >
            <RefreshCcw size={14} className={`sm:mr-1.5 ${bulkProgress?.currentOperation === 'sync' ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {bulkProgress?.currentOperation === 'sync' ? 'Sinkronisasi...' : 'Sinkronkan'}
            </span>
          </Button>
        </div>

        {/* Grup Tombol Cetak - Sebelah Kanan */}
        <div className="flex gap-2">
          {/* Tombol Cetak Belum Print */}
          <Button
            onClick={() => setIsPrintDialogOpen(true)}
            className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
            disabled={unprintedOrders.length === 0}
            title="Cetak Dokumen Belum Print"
          >
            <Printer size={14} className="sm:mr-1" />
            <span className="hidden sm:inline">
              Belum Print
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                {unprintedOrders.length}
              </span>
            </span>
            <span className="sm:hidden">
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                {unprintedOrders.length}
              </span>
            </span>
          </Button>

          {/* Tombol Cetak Semua/Terpilih */}
          <Button
            onClick={() => setIsPrintDialogOpen(true)}
            className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
            title={selectedOrders.length > 0 
              ? `Cetak ${selectedOrders.length} Dokumen`
              : `Cetak Semua (${printableOrders.length})`
            }
          >
            <PrinterCheck size={14} className="sm:mr-1" />
            <span className="hidden sm:inline">
              {selectedOrders.length > 0 
                ? `Cetak ${selectedOrders.length} Dokumen`
                : `Cetak Semua`
              }
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                {selectedOrders.length || printableOrders.length}
              </span>
            </span>
            <span className="sm:hidden">
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                {selectedOrders.length || printableOrders.length}
              </span>
            </span>
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {bulkProgress && (
        <div className="mt-2 p-2 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">
              {bulkProgress.currentOperation === 'print' && 'Mencetak dokumen'}
              {bulkProgress.currentOperation === 'accept' && 'Menerima pembatalan'}
              {bulkProgress.currentOperation === 'reject' && 'Menolak pembatalan'}
              {bulkProgress.currentOperation === 'sync' && 'Melakukan sinkronisasi'}
              {bulkProgress.currentOrder && ` - ${bulkProgress.currentOrder}`}
            </span>
            <span className="text-sm text-muted-foreground">
              {bulkProgress.processed}/{bulkProgress.total}
            </span>
          </div>
          <Progress 
            value={(bulkProgress.processed / bulkProgress.total) * 100} 
            className="h-1"
          />
        </div>
      )}

      {/* Dialog Konfirmasi Print */}
      <AlertDialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Cetak</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan mencetak {selectedOrders.length > 0 ? selectedOrders.length : printableOrders.length} dokumen.
              Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkPrint}>
              Cetak
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Konfirmasi Accept */}
      <AlertDialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Terima Pembatalan</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menerima {selectedOrders.length > 0 ? selectedOrders.length : cancellableOrders.length} pembatalan.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAcceptCancellation} className="bg-green-600 hover:bg-green-700">
              Terima
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Konfirmasi Reject */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Tolak Pembatalan</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menolak {selectedOrders.length > 0 ? selectedOrders.length : cancellableOrders.length} pembatalan.
              Pembeli tidak akan dapat mengajukan pembatalan lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkRejectCancellation} className="bg-red-600 hover:bg-red-700">
              Tolak
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
} 