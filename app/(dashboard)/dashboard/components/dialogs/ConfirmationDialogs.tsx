import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckSquare, Printer, XCircle } from "lucide-react";
import { Order } from "@/app/hooks/useDashboard";

interface ConfirmationDialogsProps {
  isPrintAllConfirmOpen: boolean;
  setIsPrintAllConfirmOpen: (open: boolean) => void;
  isProcessAllConfirmOpen: boolean;
  setIsProcessAllConfirmOpen: (open: boolean) => void;
  isAcceptAllConfirmOpen: boolean;
  setIsAcceptAllConfirmOpen: (open: boolean) => void;
  isRejectAllConfirmOpen: boolean;
  setIsRejectAllConfirmOpen: (open: boolean) => void;
  selectedOrders: string[];
  printableOrders: Order[];
  readyToShipCount: number;
  cancelRequestCount: number;
  onConfirmPrintAll: () => void;
  onConfirmProcessAll: () => void;
  onConfirmAcceptAll: () => void;
  onConfirmRejectAll: () => void;
}

export function ConfirmationDialogs({
  isPrintAllConfirmOpen,
  setIsPrintAllConfirmOpen,
  isProcessAllConfirmOpen,
  setIsProcessAllConfirmOpen,
  isAcceptAllConfirmOpen,
  setIsAcceptAllConfirmOpen,
  isRejectAllConfirmOpen,
  setIsRejectAllConfirmOpen,
  selectedOrders,
  printableOrders,
  readyToShipCount,
  cancelRequestCount,
  onConfirmPrintAll,
  onConfirmProcessAll,
  onConfirmAcceptAll,
  onConfirmRejectAll
}: ConfirmationDialogsProps) {
  return (
    <>
      {/* Print All Confirmation */}
      <AlertDialog open={isPrintAllConfirmOpen} onOpenChange={setIsPrintAllConfirmOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Konfirmasi Cetak Dokumen
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              Anda akan mencetak {selectedOrders.length > 0 
                ? selectedOrders.length 
                : printableOrders.length} dokumen yang siap cetak. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={onConfirmPrintAll}
              className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              Cetak Dokumen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Process All Confirmation */}
      <AlertDialog open={isProcessAllConfirmOpen} onOpenChange={setIsProcessAllConfirmOpen}>
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
              onClick={onConfirmProcessAll}
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

      {/* Accept All Confirmation */}
      <AlertDialog open={isAcceptAllConfirmOpen} onOpenChange={setIsAcceptAllConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-green-500" />
              <span>Terima Semua Pembatalan</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Anda akan menerima {cancelRequestCount} permintaan pembatalan pesanan.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-800 text-xs dark:bg-amber-900/30 dark:border-amber-800/30 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500">●</span>
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
              onClick={onConfirmAcceptAll}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Terima Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject All Confirmation */}
      <AlertDialog open={isRejectAllConfirmOpen} onOpenChange={setIsRejectAllConfirmOpen}>
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
                  <span className="text-blue-500">●</span>
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
              onClick={onConfirmRejectAll}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Tolak Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 