'use client'

import { Calendar as CalendarIcon, Search, X, Store, BarChart3, FileText, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { id } from 'date-fns/locale'
import { cn } from "@/lib/utils"
import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"

interface OrderToolbarProps {
    // Date picker
    date: DateRange | undefined;
    selectedDateRange: DateRange | undefined;
    isCalendarOpen: boolean;
    setIsCalendarOpen: (open: boolean) => void;
    onDateSelect: (dateRange: DateRange | undefined) => void;
    onApplyDate: () => void;
    onPresetDate: (days: number) => void;

    // Shop filter
    uniqueShops: string[];
    selectedShops: string[];
    setSelectedShops: (shops: string[]) => void;
    isShopFilterOpen: boolean;
    setIsShopFilterOpen: (open: boolean) => void;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchType: string;
    setSearchType: (type: string) => void;
    onSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onClearSearch: () => void;

    // View mode
    viewMode: 'chart' | 'text';
    setViewMode: (mode: 'chart' | 'text') => void;

    // Escrow sync
    ordersWithoutEscrow: number;
    syncingEscrow: boolean;
    syncType: string;
    syncProgress: number;
    onSyncEscrow: () => void;
}

export function OrderToolbar({
    date,
    selectedDateRange,
    isCalendarOpen,
    setIsCalendarOpen,
    onDateSelect,
    onApplyDate,
    onPresetDate,
    uniqueShops,
    selectedShops,
    setSelectedShops,
    isShopFilterOpen,
    setIsShopFilterOpen,
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    onSearch,
    onClearSearch,
    viewMode,
    setViewMode,
    ordersWithoutEscrow,
    syncingEscrow,
    syncType,
    syncProgress,
    onSyncEscrow
}: OrderToolbarProps) {
    return (
        <Card className="shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-2">
                {/* Date Picker */}
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-full justify-start text-left font-normal h-9",
                                !selectedDateRange && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDateRange?.from ? (
                                selectedDateRange.to ? (
                                    <>
                                        {format(selectedDateRange.from, "dd MMM", { locale: id })} -{" "}
                                        {format(selectedDateRange.to, "dd MMM yyyy", { locale: id })}
                                    </>
                                ) : (
                                    format(selectedDateRange.from, "dd MMM yyyy", { locale: id })
                                )
                            ) : (
                                <span>Pilih tanggal</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3">
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Button variant="outline" size="sm" onClick={() => onPresetDate(0)}>Hari Ini</Button>
                                <Button variant="outline" size="sm" onClick={() => onPresetDate(1)}>Kemarin</Button>
                                <Button variant="outline" size="sm" onClick={() => onPresetDate(7)}>7 Hari</Button>
                                <Button variant="outline" size="sm" onClick={() => onPresetDate(30)}>30 Hari</Button>
                                <Button variant="outline" size="sm" onClick={() => onPresetDate(-1)}>Bulan Ini</Button>
                                <Button variant="outline" size="sm" onClick={() => onPresetDate(-2)}>Bulan Lalu</Button>
                            </div>
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={onDateSelect}
                                numberOfMonths={2}
                                locale={id}
                            />
                            <div className="mt-3 flex justify-end">
                                <Button onClick={onApplyDate}>Terapkan</Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Shop Filter */}
                <Popover open={isShopFilterOpen} onOpenChange={setIsShopFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start h-9">
                            <Store className="mr-2 h-4 w-4" />
                            {selectedShops.length === 0 ? (
                                "Semua Toko"
                            ) : selectedShops.length === 1 ? (
                                selectedShops[0]
                            ) : (
                                `${selectedShops.length} Toko Dipilih`
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                        <ScrollArea className="h-[200px]">
                            <div className="p-2">
                                <div
                                    className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer"
                                    onClick={() => setSelectedShops([])}
                                >
                                    <Checkbox
                                        checked={selectedShops.length === 0}
                                        onCheckedChange={() => setSelectedShops([])}
                                    />
                                    <span className="text-sm">Semua Toko</span>
                                </div>
                                {uniqueShops.map((shop) => (
                                    <div
                                        key={shop}
                                        className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer"
                                        onClick={() => {
                                            if (selectedShops.includes(shop)) {
                                                setSelectedShops(selectedShops.filter(s => s !== shop));
                                            } else {
                                                setSelectedShops([...selectedShops, shop]);
                                            }
                                        }}
                                    >
                                        <Checkbox
                                            checked={selectedShops.includes(shop)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedShops([...selectedShops, shop]);
                                                } else {
                                                    setSelectedShops(selectedShops.filter(s => s !== shop));
                                                }
                                            }}
                                        />
                                        <span className="text-sm truncate">{shop}</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                </Popover>

                {/* Search */}
                <div className="flex gap-1">
                    <Select value={searchType} onValueChange={setSearchType}>
                        <SelectTrigger className="w-[110px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="order_sn">No. Pesanan</SelectItem>
                            <SelectItem value="tracking_number">No. Resi</SelectItem>
                            <SelectItem value="username">Username</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={onSearch}
                            className="w-full h-9 pl-8 pr-8 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {searchQuery && (
                            <button
                                onClick={onClearSearch}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                            >
                                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </button>
                        )}
                    </div>
                </div>

                {/* View Toggle & Sync */}
                <div className="flex gap-1">
                    <Button
                        variant={viewMode === 'chart' ? 'default' : 'outline'}
                        size="sm"
                        className="h-9 flex-1"
                        onClick={() => setViewMode('chart')}
                    >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Chart
                    </Button>
                    <Button
                        variant={viewMode === 'text' ? 'default' : 'outline'}
                        size="sm"
                        className="h-9 flex-1"
                        onClick={() => setViewMode('text')}
                    >
                        <FileText className="h-4 w-4 mr-1" />
                        Text
                    </Button>
                    {ordersWithoutEscrow > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={onSyncEscrow}
                            disabled={syncingEscrow}
                        >
                            <RefreshCw className={cn("h-4 w-4", syncingEscrow && "animate-spin")} />
                            {syncingEscrow ? (
                                <span className="ml-1 text-xs">{syncProgress}%</span>
                            ) : (
                                <span className="ml-1 text-xs">{ordersWithoutEscrow}</span>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
}
