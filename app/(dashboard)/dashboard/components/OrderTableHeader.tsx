import { Dispatch, SetStateAction } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, X, CheckSquare } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { MobileSelect } from "./MobileSelect"
import { FilterContent } from "./FilterContent"

interface OrderTableHeaderProps {
  tableState: {
    searchTerm: string;
    selectedShops: string[];
    activeCategory: string;
    showCheckbox: boolean;
    printStatus: 'all' | 'printed' | 'unprinted';
    selectedCouriers: string[];
    paymentType: 'all' | 'cod' | 'non_cod';
  };
  setTableState: (value: React.SetStateAction<any>) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  handleSearchInput: (value: string) => void;
  clearSearch: () => void;
  handleToggleCheckbox: () => void;
  handleCategoryChange: (categoryName: string) => void;
  handleShopFilter: (shopName: string) => void;
  handleCourierFilter: (courier: string) => void;
  handlePrintStatusFilter: (status: 'all' | 'printed' | 'unprinted') => void;
  handlePaymentTypeFilter: (type: 'all' | 'cod' | 'non_cod') => void;
  handleResetFilter: () => void;
  derivedData: {
    shops: string[];
    availableCouriers: string[];
    updatedCategories: Array<{
      name: string;
      status: string;
      count?: number;
    }>;
  };
}

export function OrderTableHeader({
  tableState,
  setTableState,
  searchInput,
  setSearchInput,
  handleSearchInput,
  clearSearch,
  handleToggleCheckbox,
  handleCategoryChange,
  handleShopFilter,
  handleCourierFilter,
  handlePrintStatusFilter,
  handlePaymentTypeFilter,
  handleResetFilter,
  derivedData
}: OrderTableHeaderProps) {
  return (
    <Card className="px-2 py-2 shadow-none rounded-lg">
      {/* Mobile Layout */}
      <div className="flex flex-col gap-2 sm:hidden">
        <MobileSelect 
          activeCategory={tableState.activeCategory}
          categories={derivedData.updatedCategories}
          onCategoryChange={handleCategoryChange}
        />
        {/* Baris Pencarian dengan Filter Toko dan Checkbox */}
        <div className="flex items-center gap-2">
          {/* Tombol Toggle Checkbox untuk Mobile */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleCheckbox}
            className={`h-8 w-8 p-0 ${tableState.showCheckbox ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
          >
            <CheckSquare size={14} />
          </Button>

          {/* Input Pencarian untuk Mobile */}
          <div className="relative flex-1 min-w-[200px]">
            <Input
              type="text"
              placeholder="Cari username, kurir, atau no. pesanan"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="h-8 text-xs pl-8 pr-8"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              name="search-input"
            />
            <Search size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>

          {/* Tombol Filter untuk Mobile */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <Filter size={14} />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-72" 
              align="end"
              side="bottom"
              sideOffset={5}
              style={{
                maxHeight: 'calc(80vh - 190px)',
                overflowY: 'auto'
              }}
            >
              <div className="p-1">
                <FilterContent 
                  tableState={tableState}
                  setTableState={setTableState}
                  shops={derivedData.shops}
                  availableCouriers={derivedData.availableCouriers}
                  onShopFilter={handleShopFilter}
                  onCourierFilter={handleCourierFilter}
                  onPrintStatusFilter={handlePrintStatusFilter}
                  onPaymentTypeFilter={handlePaymentTypeFilter}
                  onResetFilter={handleResetFilter}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Tombol Toggle Checkbox - Kiri */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleCheckbox}
          className={`h-8 ${tableState.showCheckbox ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
        >
          <CheckSquare size={14} />
          {tableState.showCheckbox}
        </Button>

        {/* Kategori - Tengah */}
        <div className="flex gap-2 flex-1">
          {derivedData.updatedCategories.map((category) => (
            <Button
              key={category.name}
              onClick={() => handleCategoryChange(category.name)}
              variant={tableState.activeCategory === category.name ? "default" : "outline"}
              size="sm"
              className={`h-8 px-3 text-xs whitespace-nowrap
                ${tableState.activeCategory === category.name
                  ? 'bg-primary hover:bg-primary/90 text-white dark:bg-primary-foreground'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              {category.name} ({category.count})
            </Button>
          ))}
        </div>

        {/* Pencarian dan Filter - Kanan */}
        <div className="flex items-center gap-2">
          <div className="relative w-[300px]">
            <Input
              type="text"
              placeholder="Cari username pesanan atau no resi..."
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="h-8 text-xs pl-8 pr-8"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              name="search-input-desktop"
            />
            <Search size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            
            {/* Tombol X untuk clear input */}
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Hapus pencarian"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter size={14}/>
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80" 
              align="end" 
              alignOffset={-10} 
              sideOffset={5}
            >
              <FilterContent 
                tableState={tableState}
                setTableState={setTableState}
                shops={derivedData.shops}
                availableCouriers={derivedData.availableCouriers}
                onShopFilter={handleShopFilter}
                onCourierFilter={handleCourierFilter}
                onPrintStatusFilter={handlePrintStatusFilter}
                onPaymentTypeFilter={handlePaymentTypeFilter}
                onResetFilter={handleResetFilter}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Card>
  )
} 