import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { InactiveFlashSaleAlert } from "./InactiveFlashSaleAlert"
import { useState } from "react"

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
}

export function InactiveFlashSaleIndicator({ data, onShopSelect }: Props) {
  const [open, setOpen] = useState(false);
  
  if (!data || data.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          <span>{data.length} Toko Bermasalah</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold mb-4">
          Flash Sale Bermasalah
        </DialogTitle>
        <InactiveFlashSaleAlert 
          data={data} 
          onShopSelect={onShopSelect}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
} 