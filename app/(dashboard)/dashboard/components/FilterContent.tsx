import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dispatch, SetStateAction } from "react";

interface FilterContentProps {
  tableState: {
    selectedShops: string[];
    selectedCouriers: string[];
    printStatus: 'all' | 'printed' | 'unprinted';
    paymentType: 'all' | 'cod' | 'non_cod';
  };
  setTableState: Dispatch<SetStateAction<any>>;
  shops: string[];
  availableCouriers: string[];
  onShopFilter: (shopName: string) => void;
  onCourierFilter: (courier: string) => void;
  onPrintStatusFilter: (status: 'all' | 'printed' | 'unprinted') => void;
  onPaymentTypeFilter: (type: 'all' | 'cod' | 'non_cod') => void;
  onResetFilter: () => void;
}

export function FilterContent({
  tableState,
  setTableState,
  shops,
  availableCouriers,
  onShopFilter,
  onCourierFilter,
  onPrintStatusFilter,
  onPaymentTypeFilter,
  onResetFilter
}: FilterContentProps) {
  return (
    <div className="p-2 space-y-3">
      {/* Filter Toko */}
      <div>
        <Label className="text-sm font-medium">Toko</Label>
        <div className="mt-1 space-y-1">
          {shops.map((shop) => (
            <div key={shop} className="flex items-center space-x-2">
              <Checkbox
                id={shop}
                checked={tableState.selectedShops.includes(shop)}
                onCheckedChange={() => onShopFilter(shop)}
              />
              <Label htmlFor={shop} className="text-sm font-normal">
                {shop}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Kurir */}
      <div>
        <Label className="text-sm font-medium">Kurir</Label>
        <div className="mt-1 space-y-1">
          {availableCouriers.map((courier) => (
            <div key={courier} className="flex items-center space-x-2">
              <Checkbox
                id={courier}
                checked={tableState.selectedCouriers.includes(courier)}
                onCheckedChange={() => onCourierFilter(courier)}
              />
              <Label htmlFor={courier} className="text-sm font-normal">
                {courier}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Status Cetak */}
      <div>
        <Label className="text-sm font-medium">Status Print</Label>
        <Select
          value={tableState.printStatus}
          onValueChange={(value) => onPrintStatusFilter(value as 'all' | 'printed' | 'unprinted')}
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue placeholder="Pilih status cetak" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="printed">Sudah Dicetak</SelectItem>
            <SelectItem value="unprinted">Belum Dicetak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filter Tipe Pembayaran */}
      <div>
        <Label className="text-sm font-medium">Jenis Pembayaran</Label>
        <Select
          value={tableState.paymentType}
          onValueChange={(value) => onPaymentTypeFilter(value as 'all' | 'cod' | 'non_cod')}
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue placeholder="Pilih tipe pembayaran" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="cod">COD</SelectItem>
            <SelectItem value="non_cod">Non-COD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tombol Reset */}
      <Button variant="outline" className="w-full h-8 mt-2" onClick={onResetFilter}>
        Reset Filter
      </Button>
    </div>
  );
} 