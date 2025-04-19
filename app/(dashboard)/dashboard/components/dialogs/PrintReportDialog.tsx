import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, RefreshCcw } from "lucide-react";
import { Order } from "@/app/hooks/useDashboard";

interface PrintReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  printReport: {
    totalSuccess: number;
    totalFailed: number;
    shopReports: {
      shopName: string;
      success: number;
      failed: number;
    }[];
  };
  failedOrders: {
    orderSn: string;
    shopName: string;
    carrier: string;
    trackingNumber: string;
  }[];
  shopBlobs: {
    shopName: string;
    blob: Blob;
  }[];
  orders: Order[];
  onBulkPrint: (orders: Order[]) => void;
  onDownloadDocument: (order: Order) => void;
  isLoadingForOrder: (orderSn: string) => boolean;
  isOrderCheckable: (order: Order) => boolean;
}

export function PrintReportDialog({
  isOpen,
  onOpenChange,
  printReport,
  failedOrders,
  shopBlobs,
  orders,
  onBulkPrint,
  onDownloadDocument,
  isLoadingForOrder,
  isOrderCheckable
}: PrintReportDialogProps) {
  const openSavedPDF = (shopName: string) => {
    const shopBlob = shopBlobs.find(sb => sb.shopName === shopName);
    
    if (shopBlob) {
      const pdfUrl = URL.createObjectURL(shopBlob.blob);
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${shopName.replace(/\s+/g, '_')}_shipping_labels.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${shopName}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin:0;padding:0;height:100vh;">
                <embed src="${pdfUrl}" type="application/pdf" width="100%" height="100%">
                <div style="position:fixed;bottom:20px;right:20px;display:none;" class="mobile-download">
                  <a href="${pdfUrl}" download="${shopName.replace(/\s+/g, '_')}_shipping_labels.pdf" 
                     style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-family:system-ui;">
                    Download PDF
                  </a>
                </div>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
      }

      setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-white">
            Laporan Hasil Pencetakan
          </AlertDialogTitle>
          
          <AlertDialogDescription className="dark:text-gray-300 overflow-y-auto">
            <div className="space-y-4 pr-2">
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
                
                <div className="max-h-[400px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {printReport.shopReports.map((report, index) => (
                      <div 
                        key={index}
                        className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-medium text-sm dark:text-white truncate flex-1 mr-2">
                            {report.shopName}
                          </div>
                          <Button
                            onClick={() => {
                              if (shopBlobs.some(sb => sb.shopName === report.shopName)) {
                                openSavedPDF(report.shopName);
                              } else {
                                const shopOrders = orders.filter(order => 
                                  order.shop_name === report.shopName && 
                                  isOrderCheckable(order)
                                );
                                onBulkPrint(shopOrders);
                              }
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                            title={`${shopBlobs.some(sb => sb.shopName === report.shopName) 
                              ? 'Buka PDF tersimpan' 
                              : 'Download ulang dokumen'} ${report.shopName}`}
                          >
                            <Download size={14} className="text-gray-600 dark:text-gray-400" />
                          </Button>
                        </div>
                        <div className="text-xs mt-2 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Berhasil:</span>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {report.success}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Gagal:</span>
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {report.failed}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Total:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              {report.success + report.failed}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {failedOrders.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium dark:text-white">
                      Daftar Pesanan Gagal ({failedOrders.length}):
                    </h4>
                    <Button
                      onClick={() => {
                        const failedOrdersData = orders.filter(order => 
                          failedOrders.some(failed => failed.orderSn === order.order_sn)
                        );
                        onBulkPrint(failedOrdersData);
                      }}
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
                        {failedOrders.map((order, index) => {
                          const orderData = orders.find(o => o.order_sn === order.orderSn);
                          return (
                            <TableRow key={order.orderSn} className="dark:border-gray-700">
                              <TableCell className="text-xs dark:text-gray-300 py-2">
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{order.orderSn}</span>
                                  {orderData?.cod && (
                                    <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white dark:bg-red-500 shrink-0">
                                      COD
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs dark:text-gray-300 py-2">
                                <span className="truncate block">{order.shopName}</span>
                              </TableCell>
                              <TableCell className="text-xs dark:text-gray-300 py-2">
                                <span className="text-gray-500 dark:text-gray-400">
                                  {order.carrier}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-2">
                                {orderData && (
                                  <Button
                                    onClick={() => onDownloadDocument(orderData)}
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t dark:border-gray-700">
          <AlertDialogAction 
            onClick={() => onOpenChange(false)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            Tutup
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 