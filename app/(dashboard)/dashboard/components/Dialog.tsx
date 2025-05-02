import React, { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, AlertCircle, XCircle, Info, Printer, RefreshCcw, AlertTriangle } from 'lucide-react'
import { OrderStatus } from "../types"

// Dialog Konfirmasi Pembatalan
export function CancellationConfirmDialog({
  open,
  onOpenChange,
  selectedAction,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedAction: { orderSn: string; action: 'ACCEPT' | 'REJECT' }
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-white">
            Konfirmasi Pembatalan
          </AlertDialogTitle>
          <AlertDialogDescription className="dark:text-gray-300">
            Apakah Anda yakin ingin {selectedAction.action === 'ACCEPT' ? 'menerima' : 'menolak'} pembatalan untuk pesanan ini?
            {selectedAction.action === 'ACCEPT' 
              ? ' Pesanan akan dibatalkan.'
              : ' Pembeli tidak akan dapat mengajukan pembatalan lagi.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={`text-white ${
              selectedAction.action === 'ACCEPT' 
                ? 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800' 
                : 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
            }`}
          >
            {selectedAction.action === 'ACCEPT' ? 'Terima Pembatalan' : 'Tolak Pembatalan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Dialog Konfirmasi Cetak Belum Print
export function UnprintedConfirmDialog({
  open,
  onOpenChange,
  unprintedCount,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  unprintedCount: number
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-white">
            Konfirmasi Cetak Dokumen Belum Print
          </AlertDialogTitle>
          <AlertDialogDescription className="dark:text-gray-300">
            Anda akan mencetak {unprintedCount} dokumen yang belum pernah dicetak sebelumnya. 
            Setelah dicetak, dokumen akan ditandai sebagai sudah dicetak. Lanjutkan?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            Cetak Dokumen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Dialog Konfirmasi Cetak Semua
export function PrintAllConfirmDialog({
  open,
  onOpenChange,
  selectedOrdersCount,
  totalPrintableDocuments,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedOrdersCount: number
  totalPrintableDocuments: number
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-white">
            Konfirmasi Cetak Dokumen
          </AlertDialogTitle>
          <AlertDialogDescription className="dark:text-gray-300">
            Anda akan mencetak {selectedOrdersCount > 0 
              ? selectedOrdersCount 
              : totalPrintableDocuments} dokumen yang siap cetak. Lanjutkan?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            Cetak Dokumen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Dialog Konfirmasi Proses Pesanan
export function ProcessAllConfirmDialog({
  open,
  onOpenChange,
  readyToShipCount,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  readyToShipCount: number
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-white">
            Konfirmasi Proses Pesanan
          </AlertDialogTitle>
          <AlertDialogDescription className="dark:text-gray-300">
            Anda akan memproses {readyToShipCount} pesanan yang siap kirim. 
            Proses ini tidak dapat dibatalkan. Lanjutkan?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Proses Semua
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-white dark:bg-white/20 dark:text-white text-[10px] font-medium">
              {readyToShipCount}
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Dialog Konfirmasi Tolak Semua
export function RejectAllConfirmDialog({
  open,
  onOpenChange,
  cancelRequestCount,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cancelRequestCount: number
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span>Tolak Semua Pembatalan</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Anda akan menolak {cancelRequestCount} permintaan pembatalan pesanan.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-blue-800 text-xs dark:bg-blue-900/30 dark:border-blue-800/30 dark:text-blue-300">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Pembeli tidak akan dapat mengajukan pembatalan lagi untuk pesanan-pesanan ini.</p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="mt-0">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Tolak Semua
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Dialog Laporan Cetak
export interface PrintReport {
  totalSuccess: number
  totalFailed: number
  shopReports: {
    shopName: string
    total: number
    processed: number
    failed: number
    expectedTotal?: number
    actualProcessed?: number
  }[]
}

export interface FailedOrderInfo {
  orderSn: string
  shopName: string
  courier?: string
}

export function PrintReportDialog({
  open,
  onOpenChange,
  printReport,
  failedOrders,
  isLoadingForOrder,
  onDownloadDocument,
  onClose,
  expectedTotal,
  actualTotal,
  onMismatch
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  printReport: PrintReport
  failedOrders: FailedOrderInfo[]
  isLoadingForOrder: (orderSn: string) => boolean
  onDownloadDocument: (order: { order_sn: string }) => void
  onClose: () => void
  expectedTotal?: number
  actualTotal?: number
  onMismatch?: () => void
}) {
  useEffect(() => {
    if (expectedTotal && actualTotal && expectedTotal !== actualTotal) {
      onMismatch?.();
    }
  }, [expectedTotal, actualTotal, onMismatch]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-white flex items-center justify-between">
            <span>Laporan Hasil Pencetakan</span>
            {expectedTotal && actualTotal && expectedTotal !== actualTotal && (
              <span className="text-sm text-red-500 flex items-center">
                <AlertTriangle size={14} className="mr-1" />
                Jumlah dokumen tidak sesuai
              </span>
            )}
          </AlertDialogTitle>
          
          <AlertDialogDescription className="dark:text-gray-300 overflow-y-auto">
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Ringkasan</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p>Total Berhasil: {printReport.totalSuccess}</p>
                    <p>Total Gagal: {printReport.totalFailed}</p>
                  </div>
                  {expectedTotal && (
                    <div>
                      <p>Total Diproses: {actualTotal}</p>
                      <p>Total Seharusnya: {expectedTotal}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 pt-4 pb-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <div className="text-xl font-bold text-green-700 dark:text-green-400">
                      {printReport.totalSuccess}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-300">
                      Berhasil
                    </div>
                  </div>
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <div className="text-xl font-bold text-red-700 dark:text-red-400">
                      {printReport.totalFailed}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-300">
                      Gagal
                    </div>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
                      {printReport.totalSuccess + printReport.totalFailed}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-300">
                      Total
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-medium mb-2 dark:text-white sticky top-[100px] bg-white dark:bg-gray-800 py-2 z-10">
                  Detail per Toko ({printReport.shopReports.length}):
                </h4>
                
                <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {printReport.shopReports.map((report, index) => (
                    <div 
                      key={index}
                      className="p-3 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium dark:text-white truncate">
                          {report.shopName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 shrink-0">
                          Total: {report.total}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-green-500">●</span>
                          <span className="text-gray-600 dark:text-gray-300">
                            Berhasil: {report.processed}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-red-500">●</span>
                          <span className="text-gray-600 dark:text-gray-300">
                            Gagal: {report.failed}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {failedOrders.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium dark:text-white">
                        Daftar Pesanan Gagal ({failedOrders.length}):
                      </h4>
                      <Button
                        onClick={() => onClose()}
                        size="sm"
                        className="h-7 bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
                      >
                        <Printer size={14} className="mr-1" />
                        Cetak Ulang
                      </Button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="dark:border-gray-700">
                            <TableHead className="font-bold text-xs dark:text-white w-[300px]">No. Pesanan</TableHead>
                            <TableHead className="font-bold text-xs dark:text-white w-[300px]">Toko</TableHead>
                            <TableHead className="font-bold text-xs dark:text-white w-[200px]">Kurir</TableHead>
                            <TableHead className="font-bold text-xs dark:text-white w-[60px] text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {failedOrders.map((order, index) => (
                            <TableRow key={order.orderSn} className="dark:border-gray-700">
                              <TableCell className="text-xs dark:text-gray-300 py-2">
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{order.orderSn}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs dark:text-gray-300 py-2">
                                {order.shopName}
                              </TableCell>
                              <TableCell className="text-xs dark:text-gray-300 py-2">
                                {order.courier || '-'}
                              </TableCell>
                              <TableCell className="text-center py-2">
                                {onDownloadDocument && (
                                  <Button
                                    onClick={() => onDownloadDocument({ order_sn: order.orderSn })}
                                    disabled={isLoadingForOrder(order.orderSn)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:text-primary dark:hover:text-primary"
                                  >
                                    {isLoadingForOrder(order.orderSn) ? (
                                      <RefreshCcw size={12} className="animate-spin" />
                                    ) : (
                                      <Printer size={12} />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t dark:border-gray-700">
          <AlertDialogAction 
            onClick={onClose}
            className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            Tutup
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Dialog Ringkasan Sinkronisasi
export interface SyncSummary {
  totalOrders: number
  processedOrders: number
  shopReports: { shopName: string; total: number; processed: number; failed: number }[]
}

export function SyncSummaryDialog({
  open,
  onOpenChange,
  syncSummary,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  syncSummary: SyncSummary
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader className="px-6 py-4 border-b dark:border-gray-700">
          <DialogTitle className="dark:text-white">Ringkasan Sinkronisasi</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {syncSummary.totalOrders}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Total Pesanan
              </div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {syncSummary.processedOrders}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Berhasil
              </div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {syncSummary.totalOrders - syncSummary.processedOrders}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                Gagal
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Detail per Toko
            </h3>
            <div className="space-y-2">
              {syncSummary.shopReports.map((report, index) => (
                <div 
                  key={index}
                  className="p-3 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm dark:text-white">
                      {report.shopName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Total: {report.total}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-green-500">●</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        Berhasil: {report.processed}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-red-500">●</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        Gagal: {report.failed}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Dialog Konfirmasi Terima Semua Pembatalan
export function AcceptAllConfirmDialog({
  open,
  onOpenChange,
  eligibleForAccept,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  eligibleForAccept: number
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Terima Semua Pembatalan</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Anda akan menerima {eligibleForAccept} permintaan pembatalan pesanan yang belum dicetak.
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-800 text-xs dark:bg-amber-900/30 dark:border-amber-800/30 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Pesanan-pesanan ini akan dibatalkan secara permanen dan tidak dapat dikembalikan.</p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="mt-0">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Terima Semua
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 