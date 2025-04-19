import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Order } from "@/app/hooks/useDashboard";

interface SyncSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  syncSummary: {
    totalOrders: number;
    processedOrders: number;
    shopReports: {
      shopName: string;
      total: number;
      processed: number;
      failed: number;
    }[];
  };
}

export function SyncSummaryDialog({
  isOpen,
  onOpenChange,
  syncSummary
}: SyncSummaryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader className="px-6 py-4 border-b dark:border-gray-700">
          <DialogTitle className="dark:text-white">Ringkasan Sinkronisasi</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Statistik Utama */}
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

          {/* Detail per Toko */}
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
  );
} 