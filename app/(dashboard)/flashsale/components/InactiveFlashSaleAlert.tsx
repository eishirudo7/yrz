import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

import dayjs from "dayjs"

interface FlashSaleIssue {
  shop_id: number;
  shop_name: string;
  issues: {
    inactive_current: number;
    no_active_flashsale: boolean;
    upcoming_count: number;
    inactive_upcoming: number;
  };
  details: Array<{
    flash_sale_id: number;
    start_time: number;
    end_time: number;
    type: string;
  }>;
}

interface Props {
  data: FlashSaleIssue[];
  onShopSelect: (shopId: number) => void;
  onClose?: () => void;
}

export function InactiveFlashSaleAlert({ data, onShopSelect, onClose }: Props) {
  if (!data || data.length === 0) return null;

  const handleShopSelect = (shopId: number) => {
    onShopSelect(shopId);
    onClose?.();
  };

  return (
    <div className="space-y-4 relative z-10">
      {data.map((issue) => (
        <div
          key={issue.shop_id}
          className="p-5 border rounded-lg bg-red-50/80 border-red-200 dark:bg-red-900/40 dark:border-red-800/40 relative"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-1" />
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  {issue.shop_name}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShopSelect(issue.shop_id)}
                  className="h-8 px-3 text-red-700 hover:text-red-800 hover:bg-red-100/80 dark:text-red-200 dark:hover:bg-red-800/60"
                >
                  Lihat Flash Sale
                </Button>
              </div>

              <div className="space-y-2 text-sm text-red-700 dark:text-red-300">
                {/* Flash Sale yang sedang berjalan tidak aktif */}
                {issue.issues.inactive_current > 0 && (
                  <p className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {issue.issues.inactive_current} flash sale sedang berjalan tidak memiliki item aktif
                  </p>
                )}

                {/* Tidak ada Flash Sale aktif */}
                {issue.issues.no_active_flashsale && (
                  <p className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    Tidak ada flash sale yang sedang berjalan
                  </p>
                )}

                {/* Flash Sale yang akan datang < 2 */}
                {issue.issues.upcoming_count < 3 && (
                  <p className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    Hanya memiliki {issue.issues.upcoming_count} flash sale yang akan datang
                  </p>
                )}

                {/* Flash Sale yang akan datang tidak aktif */}
                {issue.issues.inactive_upcoming > 0 && (
                  <p className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {issue.issues.inactive_upcoming} flash sale yang akan datang tidak memiliki item aktif
                  </p>
                )}
              </div>

              {/* Detail Flash Sale bermasalah */}
              {issue.details.length > 0 && (
                <div className="mt-4 space-y-2">
                  {issue.details.map((detail) => (
                    <div
                      key={detail.flash_sale_id}
                      className="text-xs text-red-700 dark:text-red-300 bg-red-100/70 dark:bg-red-900/60 px-4 py-2.5 rounded-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Flash Sale #{detail.flash_sale_id}</span>
                        <span className="text-red-600 dark:text-red-400">
                          {dayjs(detail.start_time * 1000).format('DD/MM/YYYY HH:mm')} - {dayjs(detail.end_time * 1000).format('HH:mm')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 