'use client';

import { useDiscounts } from '@/hooks/useDiscounts';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus as PlusIcon, Copy as CopyIcon, Trash as TrashIcon, StopCircle as StopIcon, Loader2Icon, CheckIcon, AlertTriangleIcon } from 'lucide-react';
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical as MoreVerticalIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface DiscountModel {
  model_id: number;
  model_promotion_price: number;
  model_promotion_stock: number;
}

interface DiscountItem {
  item_id: number;
  model_list: DiscountModel[];
}

const TableSkeleton = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-gray-900">
            <TableHead className="w-[200px] font-semibold dark:text-gray-200">Nama Toko</TableHead>
            <TableHead className="w-[250px] font-semibold dark:text-gray-200">Nama Promo</TableHead>
            <TableHead className="w-[120px] font-semibold dark:text-gray-200">Status</TableHead>
            <TableHead className="w-[150px] font-semibold dark:text-gray-200">Mulai</TableHead>
            <TableHead className="w-[150px] font-semibold dark:text-gray-200">Selesai</TableHead>
            <TableHead className="w-[200px] text-right font-semibold dark:text-gray-200">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-[180px]" />
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[100px]" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-[80px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[120px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[120px]" />
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-end">
                  <Skeleton className="h-8 w-[90px]" />
                  <Skeleton className="h-8 w-[90px]" />
                  <Skeleton className="h-8 w-[90px]" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default function DiscountsPage() {
  const router = useRouter();
  const { 
    discounts, 
    isLoading, 
    error, 
    selectedStatus, 
    setSelectedStatus,
    refetch
  } = useDiscounts();
  const [selectedDiscount, setSelectedDiscount] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedShop, setSelectedShop] = useState<string>("all");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateProgress, setDuplicateProgress] = useState<{
    step: number;
    message: string;
  }>({ step: 0, message: '' });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="mb-8">
          <Skeleton className="h-8 w-[300px] mb-2" />
          <Skeleton className="h-4 w-[400px]" />
        </div>

        <div className="flex justify-between items-center mb-6 gap-4">
          <div className="flex gap-4 flex-1">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[200px]" />
          </div>
          <Skeleton className="h-10 w-[150px]" />
        </div>

        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ongoing':
        return 'bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/20';
      case 'upcoming':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20';
      case 'expired':
        return 'bg-gray-500/15 text-gray-700 dark:text-gray-400 hover:bg-gray-500/20';
      default:
        return 'bg-gray-500/15 text-gray-700 dark:text-gray-400 hover:bg-gray-500/20';
    }
  };

  const handleRowClick = (shopId: number, discountId: number) => {
    router.push(`/discounts/${discountId}?shopId=${shopId}`);
  };

  const handleAddDiscount = () => {
    router.push('/discounts/create');
  };

  const handleDeleteClick = (e: React.MouseEvent, shop: any, discount: any) => {
    e.stopPropagation();
    setSelectedDiscount({ shopId: shop.shop_id, discountId: discount.discount_id });
    setShowDeleteDialog(true);
  };

  const handleEndClick = (e: React.MouseEvent, shop: any, discount: any) => {
    e.stopPropagation();
    setSelectedDiscount({ shopId: shop.shop_id, discountId: discount.discount_id });
    setShowEndDialog(true);
  };

  const handleDuplicateClick = async (e: React.MouseEvent, shop: any, discount: any) => {
    e.stopPropagation();
    
    try {
      // Mengambil detail promo
      const response = await fetch(
        `/api/discount/${discount.discount_id}?shopId=${shop.shop_id}`
      );
      
      if (!response.ok) {
        throw new Error('Gagal mengambil data diskon');
      }
      
      const discountDetail = await response.json();
      
      // Hitung waktu untuk promo baru
      const oldEndTime = discountDetail.data.end_time * 1000;
      const newStartTime = oldEndTime + (60 * 1000);
      const newEndTime = newStartTime + (179 * 24 * 60 * 60 * 1000) - (60 * 1000);

      // Siapkan data item
      const itemList = discountDetail.data.item_list.map((item: DiscountItem) => ({
        item_id: item.item_id,
        model_list: item.model_list.map((model: DiscountModel) => ({
          model_id: model.model_id,
          model_promotion_price: model.model_promotion_price,
          model_promotion_stock: model.model_promotion_stock || 0
        }))
      }));

      // Request untuk membuat promo baru
      const createDiscountRequest = {
        method: 'POST',
        url: '/api/discount',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          shopId: shop.shop_id,
          discountData: {
            discount_name: discountDetail.data.discount_name,
            start_time: Math.floor(newStartTime / 1000),
            end_time: Math.floor(newEndTime / 1000)
          }
        }
      };

      // Request untuk menambahkan item (akan digunakan setelah promo dibuat)
      const addItemsRequest = {
        method: 'POST',
        url: `/api/discount/[discount_id]?action=add-items`, // discount_id akan diisi setelah promo dibuat
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          shopId: shop.shop_id,
          items: itemList
        }
      };

      // Tampilkan preview request
      setPreviewData({
        createDiscountRequest,
        addItemsRequest,
        times: {
          oldEndTime,
          newStartTime,
          newEndTime
        }
      });
      
      setShowDuplicateDialog(true);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Gagal mengambil data diskon');
    }
  };

  const confirmDelete = async () => {
    try {
      setShowDeleteDialog(false);
      
      const response = await fetch(
        `/api/discount/${selectedDiscount.discountId}?shopId=${selectedDiscount.shopId}`,
        {
          method: 'DELETE',
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Promo berhasil dihapus');
        await refetch();
      } else {
        throw new Error(data.message || 'Gagal menghapus promo');
      }
      
    } catch (error: any) {
      console.error('Error deleting discount:', error);
      toast.error('Gagal menghapus promo', {
        description: error.message
      });
    }
  };

  const confirmEnd = async () => {
    try {
      const response = await fetch(
        `/api/discount/${selectedDiscount.discountId}?action=end`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopId: selectedDiscount.shopId,
          }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Gagal mengakhiri promo');
      }
      
      // Refresh halaman untuk memperbarui data
      router.refresh();
    } catch (error: any) {
      console.error('Error ending discount:', error);
      alert(error.message);
    } finally {
      setShowEndDialog(false);
    }
  };

  const handleDuplicateConfirm = async () => {
    try {
      setIsDuplicating(true);
      
      // Langkah 1: Membuat promo baru
      setDuplicateProgress({
        step: 1,
        message: 'Membuat promo baru...'
      });
      
      const createDiscountResponse = await fetch(
        previewData.createDiscountRequest.url,
        {
          method: previewData.createDiscountRequest.method,
          headers: previewData.createDiscountRequest.headers,
          body: JSON.stringify(previewData.createDiscountRequest.body)
        }
      );

      const createDiscountResult = await createDiscountResponse.json();
      
      if (!createDiscountResult.success) {
        throw new Error('Gagal membuat promo baru');
      }

      // Langkah 2: Menambahkan produk
      setDuplicateProgress({
        step: 2,
        message: 'Menambahkan produk ke promo...'
      });

      const addItemsResponse = await fetch(
        `/api/discount/${createDiscountResult.data.discount_id}?action=add-items&shopId=${previewData.createDiscountRequest.body.shopId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId: previewData.createDiscountRequest.body.shopId,
            items: previewData.addItemsRequest.body.items
          })
        }
      );

      const addItemsResult = await addItemsResponse.json();

      if (!addItemsResult.success) {
        // Rollback jika gagal
        await fetch(
          `/api/discount/${createDiscountResult.data.discount_id}?shopId=${previewData.createDiscountRequest.body.shopId}`,
          { method: 'DELETE' }
        );
        throw new Error('Gagal menambahkan produk ke promo');
      }

      // Sukses
      setDuplicateProgress({
        step: 3,
        message: `Berhasil menambahkan ${addItemsResult.data.count} model item ke promo baru!`
      });

      // Tunda sebentar untuk menampilkan status sukses
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Tampilkan toast sebelum menutup dialog
      toast.success('Berhasil menduplikasi promo', {
        description: `${addItemsResult.data.count} model item telah ditambahkan ke promo baru.`,
        duration: 5000,
      });

      // Tunggu sebentar sebelum menutup dialog dan refresh
      setTimeout(() => {
        setShowDuplicateDialog(false);
        setPreviewData(null);
        
        // Refresh data menggunakan refetch
        refetch();
      }, 500);

    } catch (error: any) {
      toast.error('Gagal menduplikasi promo', {
        description: error.message,
        duration: 5000,
      });
    } finally {
      setIsDuplicating(false);
      setDuplicateProgress({ step: 0, message: '' });
    }
  };

  const getUniqueShops = () => {
    const shops = discounts.map(shop => ({
      id: shop.shop_id.toString(),
      name: shop.shop_name
    }));
    return shops;
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight dark:text-white">
          Daftar Promo Toko
        </h1>
        <p className="text-muted-foreground mt-1 dark:text-gray-400">
          Kelola semua promo dari berbagai toko Anda
        </p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex flex-row items-center gap-4 w-full md:w-auto">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter berdasarkan status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="ongoing">Sedang Berjalan</SelectItem>
              <SelectItem value="upcoming">Akan Datang</SelectItem>
              <SelectItem value="expired">Sudah Berakhir</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedShop} onValueChange={setSelectedShop}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter berdasarkan toko" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Toko</SelectItem>
              {getUniqueShops().map((shop) => (
                <SelectItem key={shop.id} value={shop.id}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleAddDiscount}
          className="flex items-center gap-2 w-full md:w-auto"
        >
          <PlusIcon className="w-4 h-4" />
          Buat Promo Baru
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-gray-900">
              <TableHead className="w-[200px] font-semibold dark:text-gray-200">Nama Toko</TableHead>
              <TableHead className="w-[250px] font-semibold dark:text-gray-200">Nama Promo</TableHead>
              <TableHead className="w-[120px] font-semibold dark:text-gray-200">Status</TableHead>
              <TableHead className="w-[150px] font-semibold dark:text-gray-200">Mulai</TableHead>
              <TableHead className="w-[150px] font-semibold dark:text-gray-200">Selesai</TableHead>
              <TableHead className="w-[200px] text-right font-semibold dark:text-gray-200">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts
              .filter(shop => selectedShop === "all" || shop.shop_id.toString() === selectedShop)
              .map((shop) =>
                shop.discounts
                  .filter(discount => 
                    selectedStatus === "all" || 
                    discount.status.toLowerCase() === selectedStatus.toLowerCase()
                  )
                  .map((discount) => (
                    <TableRow 
                      key={`${shop.shop_id}-${discount.discount_id}`}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-gray-700"
                      onClick={() => handleRowClick(shop.shop_id, discount.discount_id)}
                    >
                      <TableCell className="font-medium dark:text-gray-200">
                        {shop.shop_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="dark:text-gray-200">{discount.discount_name}</span>
                          <span className="text-xs text-muted-foreground dark:text-gray-400">
                            ID: {discount.discount_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(discount.status)} dark:bg-opacity-20`}
                        >
                          {discount.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col dark:text-gray-200">
                          <span>{discount.start_time_formatted}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col dark:text-gray-200">
                          <span>{discount.end_time_formatted}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVerticalIcon className="h-4 w-4" />
                                <span className="sr-only">Buka menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[160px]">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicateClick(e, shop, discount);
                                }}
                              >
                                <CopyIcon className="mr-2 h-4 w-4" />
                                <span>Duplikat</span>
                              </DropdownMenuItem>
                              
                              {discount.status.toLowerCase() === 'ongoing' && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEndClick(e, shop, discount);
                                  }}
                                  className="text-orange-600 dark:text-orange-400"
                                >
                                  <StopIcon className="mr-2 h-4 w-4" />
                                  <span>Akhiri</span>
                                </DropdownMenuItem>
                              )}
                              
                              {discount.status.toLowerCase() !== 'expired' && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(e, shop, discount);
                                  }}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  <TrashIcon className="mr-2 h-4 w-4" />
                                  <span>Hapus</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="dark:bg-gray-800 dark:text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Hapus Promo</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              Apakah Anda yakin ingin menghapus promo ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="dark:bg-red-600"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Akhiri Promo</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mengakhiri promo ini sekarang?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnd}>Akhiri</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Duplikasi Promo</DialogTitle>
            <DialogDescription>
              Promo baru akan dibuat dengan pengaturan yang sama dan dijadwalkan setelah promo yang diduplikasi berakhir.
            </DialogDescription>
          </DialogHeader>

          {isDuplicating ? (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100">
                    <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-primary animate-spin border-t-transparent" />
                  </div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    {duplicateProgress.step}/3
                  </div>
                </div>
                
                <div className="w-full max-w-sm space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        duplicateProgress.step >= 1 
                          ? 'bg-primary text-white' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {duplicateProgress.step > 1 ? (
                          <CheckIcon className="w-5 h-5" />
                        ) : (
                          '1'
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          duplicateProgress.step >= 1 ? 'text-primary' : 'text-slate-500'
                        }`}>
                          Membuat Promo Baru
                        </p>
                        <p className="text-sm text-slate-500">
                          Menyiapkan data promo baru
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        duplicateProgress.step >= 2 
                          ? 'bg-primary text-white' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {duplicateProgress.step > 2 ? (
                          <CheckIcon className="w-5 h-5" />
                        ) : (
                          '2'
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          duplicateProgress.step >= 2 ? 'text-primary' : 'text-slate-500'
                        }`}>
                          Menambahkan Produk
                        </p>
                        <p className="text-sm text-slate-500">
                          Menyalin data produk ke promo baru
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        duplicateProgress.step >= 3 
                          ? 'bg-primary text-white' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {duplicateProgress.step > 3 ? (
                          <CheckIcon className="w-5 h-5" />
                        ) : (
                          '3'
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          duplicateProgress.step >= 3 ? 'text-primary' : 'text-slate-500'
                        }`}>
                          Finalisasi
                        </p>
                        <p className="text-sm text-slate-500">
                          Menyelesaikan proses duplikasi
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-center text-primary font-medium mt-4">
                    {duplicateProgress.message}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-6">
              <div className="space-y-4">
                <div className="grid gap-4 p-4 border rounded-lg bg-slate-50">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-slate-500">Nama Promo:</span>
                    <span className="font-medium">{previewData?.createDiscountRequest.body.discountData.discount_name}</span>
                    
                    <span className="text-slate-500">Waktu Mulai:</span>
                    <span className="font-medium">
                      {new Date(previewData?.times.newStartTime).toLocaleString('id-ID', {
                        dateStyle: 'full',
                        timeStyle: 'short'
                      })}
                    </span>
                    
                    <span className="text-slate-500">Waktu Selesai:</span>
                    <span className="font-medium">
                      {new Date(previewData?.times.newEndTime).toLocaleString('id-ID', {
                        dateStyle: 'full',
                        timeStyle: 'short'
                      })}
                    </span>
                    
                    <span className="text-slate-500">Jumlah Produk:</span>
                    <span className="font-medium">
                      {previewData?.addItemsRequest.body.items.length} produk
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 text-sm bg-amber-50 border-l-4 border-amber-500 rounded">
                  <AlertTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <p>
                    Pastikan detail promo sudah sesuai. Setelah proses duplikasi selesai, 
                    Anda masih dapat mengubah pengaturan promo sebelum waktu mulai.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDuplicateDialog(false)}
              disabled={isDuplicating}
            >
              Batal
            </Button>
            <Button
              onClick={handleDuplicateConfirm}
              disabled={isDuplicating}
            >
              {isDuplicating ? (
                <>
                  <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Duplikasi Sekarang'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 