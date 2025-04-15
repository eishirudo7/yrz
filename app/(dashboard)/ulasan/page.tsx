'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StarFilledIcon, InfoCircledIcon, MagnifyingGlassIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Shop {
  id: number;
  shop_id: number;
  shop_name: string;
  region: string;
  shop_status: string;
}

interface CommentMedia {
  image_url_list?: string[];
}

interface CommentItem {
  comment_id: number;
  comment: string;
  buyer_username: string;
  order_sn: string;
  item_id: number;
  model_id: number;
  create_time: number;
  rating_star: number;
  editable: string;
  hidden: boolean;
  media: CommentMedia;
  model_id_list: number[];
  comment_reply?: {
    reply: string;
    hidden: boolean;
    create_time: number;
  };
  reply?: {
    reply_id: number;
    comment: string;
    create_time: number;
  };
}

interface CommentsResponse {
  success: boolean;
  data: {
    item_comment_list?: CommentItem[];
    comments?: CommentItem[];
    more?: boolean;
    has_more?: boolean;
    next_cursor?: string;
    cursor?: string;
  } | CommentItem[];
  request_id?: string;
}

interface ProductItem {
  item_id: number;
  item_name: string;
  item_status?: string;
  update_time?: number;
  item_sku?: string;
}

interface ProductsResponse {
  success: boolean;
  data: {
    item?: ProductItem[];
    items?: ProductItem[];
    more?: boolean;
    has_next_page?: boolean;
    next_offset?: number;
    total?: number;
  } | ProductItem[];
}

interface ProductDetail {
  item_id: number;
  item_name: string;
  item_sku: string;
  image: {
    image_url_list: string[];
  };
  price_info: {
    currency: string;
    original_price: number;
    current_price: number;
  };
  models?: Array<{
    model_id: number;
    model_name: string;
    model_sku?: string;
  }>;
}

export default function ProductCommentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<{item_id: number, item_name: string, item_sku?: string}[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  const shopId = searchParams.get('shop_id');
  const itemId = searchParams.get('item_id');
  const pageSize = 100;
  
  const [selectedShopId, setSelectedShopId] = useState<string | null>(shopId);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(itemId);

  const [productsDetails, setProductsDetails] = useState<Record<number, ProductDetail>>({});
  const [allComments, setAllComments] = useState<CommentItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFetchingAllComments, setIsFetchingAllComments] = useState(false);
  const [currentRating, setCurrentRating] = useState<number | undefined>(undefined);
  const itemsPerPage = 20;
  
  // Cache untuk menyimpan sudah di-fetch detail produk
  const [fetchedProducts, setFetchedProducts] = useState<Set<number>>(new Set());

  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
  const [isReplying, setIsReplying] = useState<boolean>(false);
  const [currentReplyCommentId, setCurrentReplyCommentId] = useState<number | null>(null);
  const [replySuccess, setReplySuccess] = useState<boolean>(false);

  // Fungsi untuk mendapatkan jumlah komentar berdasarkan rating
  const getCommentCountByRating = useCallback((rating?: number) => {
    if (!allComments.length) return 0;
    
    // Filter berdasarkan produk yang dipilih
    const filteredByItem = selectedItemId 
      ? allComments.filter(comment => comment.item_id.toString() === selectedItemId)
      : allComments;
    
    // Jika rating tidak ditentukan, kembalikan semua komentar
    if (rating === undefined) return filteredByItem.length;
    
    // Filter berdasarkan rating
    return filteredByItem.filter(comment => comment.rating_star === rating).length;
  }, [allComments, selectedItemId]);

  // Fungsi untuk fetch daftar toko
  const fetchShops = useCallback(async () => {
    try {
      setLoadingShops(true);
      const response = await fetch('/api/shops');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Gagal mengambil daftar toko');
      }
      
      setShops(data.data || []);
      
      // Jika tidak ada shopId yang dipilih, gunakan toko pertama
      if (!shopId && data.data && data.data.length > 0) {
        setSelectedShopId(data.data[0].shop_id.toString());
      }
    } catch (err) {
      console.error('Error fetching shops:', err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil daftar toko');
    } finally {
      setLoadingShops(false);
    }
  }, [shopId]);

  // Fungsi untuk fetch daftar produk berdasarkan toko
  const fetchProducts = useCallback(async (shopIdParam?: string) => {
    if (!shopIdParam && !selectedShopId) return;
    
    const shopIdToUse = shopIdParam || selectedShopId;

    try {
      setLoadingProducts(true);
      const response = await fetch(`/api/produk?shop_id=${shopIdToUse}&page_size=50`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Gagal mengambil daftar produk');
      }
      
      // Perbaiki penanganan format data untuk menyesuaikan dengan struktur yang diterima dari API
      if (data.data && data.data.items && Array.isArray(data.data.items)) {
        // Format response: { success: true, data: { shop_id: number, items: Array, total: number, has_next_page: boolean } }
        setProducts(data.data.items.map((item: ProductItem) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_sku: item.item_sku || ''
        })));
      } else if (data.data && Array.isArray(data.data.item)) {
        // Format response: { success: true, data: { item: Array } }
        setProducts(data.data.item.map((item: ProductItem) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_sku: item.item_sku || ''
        })));
      } else if (data.data && Array.isArray(data.data)) {
        // Format response: { success: true, data: Array }
        setProducts(data.data.map((item: ProductItem) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_sku: item.item_sku || ''
        })));
      } else {
        console.log('Struktur data produk:', data);
        setProducts([]);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil daftar produk');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedShopId]);

  // Fungsi untuk fetch detail produk berdasarkan item_id
  const fetchProductDetails = async (comments: CommentItem[]) => {
    if (!selectedShopId) return;
    
    try {
      // Dapatkan semua item_id unik dari komentar yang belum di-cache
      const uniqueItemIds = Array.from(
        new Set(
          comments
            .map(comment => comment.item_id)
            .filter(id => !fetchedProducts.has(id))
        )
      );
      
      if (uniqueItemIds.length === 0) return;
      
      const productDetailsMap: Record<number, ProductDetail> = {...productsDetails};
      
      // Batch requests untuk mengambil detail produk (maksimal 10 per request)
      const batchSize = 10;
      for (let i = 0; i < uniqueItemIds.length; i += batchSize) {
        const batchIds = uniqueItemIds.slice(i, i + batchSize);
        
        // Buat semua promise secara paralel
        const promises = batchIds.map(itemId => 
          fetch(`/api/produk?shop_id=${selectedShopId}&item_id=${itemId}`)
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                // Handle berbagai kemungkinan format respons
                if (data.data && data.data.item && typeof data.data.item === 'object' && !Array.isArray(data.data.item)) {
                  // Format: { success: true, data: { item: { item_id, item_name, ... } } }
                  productDetailsMap[itemId] = data.data.item;
                  return itemId;
                } else if (data.data && data.data.items && Array.isArray(data.data.items) && data.data.items.length > 0) {
                  // Format: { success: true, data: { items: [...] } }
                  const item = data.data.items.find((item: any) => item.item_id === itemId);
                  if (item) {
                    productDetailsMap[itemId] = item;
                    return itemId;
                  }
                } else if (data.data && typeof data.data === 'object' && 'item_id' in data.data) {
                  // Format: { success: true, data: { item_id, item_name, ... } }
                  productDetailsMap[itemId] = data.data;
                  return itemId;
                }
                console.log(`Format data tidak dikenali untuk item_id ${itemId}:`, data);
              }
              return null;
            })
            .catch(err => {
              console.error(`Error fetching details for item_id ${itemId}:`, err);
              return null;
            })
        );
        
        // Tunggu semua promise dalam batch selesai sebelum melanjutkan ke batch berikutnya
        const results = await Promise.all(promises);
        
        // Update cache produk yang sudah di-fetch
        const newFetchedProducts = new Set(fetchedProducts);
        results.filter(Boolean).forEach(id => id && newFetchedProducts.add(id));
        setFetchedProducts(newFetchedProducts);
      }
      
      setProductsDetails(productDetailsMap);
    } catch (err) {
      console.error('Error fetching product details:', err);
    }
  };

  // Fungsi untuk fetch semua komentar sampai tidak ada lagi
  const fetchAllComments = useCallback(async (shopIdParam?: string, itemIdParam?: string) => {
    const shopIdToUse = shopIdParam || selectedShopId;
    const itemIdToUse = itemIdParam || selectedItemId;
    
    if (!shopIdToUse) {
      setError('ID Toko diperlukan');
      return;
    }

    try {
      setIsFetchingAllComments(true);
      setLoadingComments(true);
      
      let url = `/api/ulasan?shop_id=${shopIdToUse}&page_size=${pageSize}`;
      if (itemIdToUse) url += `&item_id=${itemIdToUse}`;
      
      let allFetchedComments: CommentItem[] = [];
      let hasMoreComments = true;
      let currentCursor: string | null = null;
      let fetchCount = 0;
      const maxFetches = 10; // Batasi jumlah fetch untuk mencegah looping tak terbatas
      
      // Loop untuk fetch semua komentar
      while (hasMoreComments && fetchCount < maxFetches) {
        fetchCount++;
        const fetchUrl: string = currentCursor ? `${url}&cursor=${currentCursor}` : url;
        const response: Response = await fetch(fetchUrl);
        const data: any = await response.json();
        
        // Penanganan berbagai format respons
        if (!data.success) {
          throw new Error('Gagal mengambil data komentar');
        }
        
        let commentList: CommentItem[] = [];
        let hasMore = false;
        let nextCursor = null;
        
        // Deteksi format respons
        if (data.data && Array.isArray(data.data.item_comment_list)) {
          // Format standar: { success: true, data: { item_comment_list: [], more: boolean, next_cursor: string } }
          commentList = data.data.item_comment_list;
          hasMore = Boolean(data.data.more);
          nextCursor = data.data.next_cursor || null;
        } else if (data.data && data.data.comments && Array.isArray(data.data.comments)) {
          // Format alternatif: { success: true, data: { comments: [], has_more: boolean, cursor: string } }
          commentList = data.data.comments;
          hasMore = Boolean(data.data.has_more);
          nextCursor = data.data.cursor || null;
        } else if (data.data && Array.isArray(data.data)) {
          // Format sederhana: { success: true, data: [] }
          commentList = data.data;
          hasMore = false;
          nextCursor = null;
        } else {
          console.log('Format data komentar tidak diketahui:', data);
          break;
        }
        
        // Jika tidak ada komentar baru, keluar dari loop
        if (commentList.length === 0) {
          break;
        }
        
        allFetchedComments = [...allFetchedComments, ...commentList];
        
        // Update state lebih sering untuk UX lebih responsif setiap 2 batch
        if (fetchCount % 2 === 0) {
          setAllComments([...allFetchedComments]);
          // Reset currentPage jika komentar baru di-fetch
          setCurrentPage(1);
        }
        
        hasMoreComments = hasMore;
        currentCursor = nextCursor;
        
        // Jika tidak ada lagi data atau cursor, keluar dari loop
        if (!hasMoreComments || !currentCursor) {
          break;
        }
      }
      
      setAllComments(allFetchedComments);
      // Reset ke halaman pertama setelah mendapatkan data baru
      setCurrentPage(1);
      
      // Mulai fetch detail produk segera setelah komentar diambil
      fetchProductDetails(allFetchedComments);
      
    } catch (err) {
      console.error('Error fetching all comments:', err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data komentar');
      setAllComments([]);
    } finally {
      setLoadingComments(false);
      setIsFetchingAllComments(false);
    }
  }, [selectedShopId, selectedItemId, pageSize]);

  // Load shops pada initial render
  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Load products saat toko dipilih
  useEffect(() => {
    if (selectedShopId) {
      fetchProducts();
    }
  }, [selectedShopId, fetchProducts]);

  // Ganti useEffect untuk comments dengan fetchAllComments
  useEffect(() => {
    if (selectedShopId) {
      fetchAllComments();
    }
  }, [selectedShopId, selectedItemId, fetchAllComments]);

  const handleShopChange = (value: string) => {
    setSelectedShopId(value);
    setSelectedItemId(null);
    
    // Update URL tanpa me-refresh halaman
    const params = new URLSearchParams();
    params.set('shop_id', value);
    router.push(`/ulasan?${params.toString()}`);
  };

  const handleItemChange = (value: string) => {
    // Jika nilai adalah _all, anggap sebagai tidak ada filter produk
    const itemIdToUse = value === "_all" ? null : value;
    setSelectedItemId(itemIdToUse);
    
    // Reset halaman ke halaman pertama saat produk berubah
    setCurrentPage(1);
    
    // Update URL tanpa me-refresh halaman
    const params = new URLSearchParams();
    if (selectedShopId) params.set('shop_id', selectedShopId);
    if (itemIdToUse) params.set('item_id', itemIdToUse);
    router.push(`/ulasan?${params.toString()}`);
  };

  const handleResetFilters = () => {
    setSelectedItemId(null);
    setCurrentPage(1); // Reset ke halaman pertama
    
    const params = new URLSearchParams();
    if (selectedShopId) params.set('shop_id', selectedShopId);
    router.push(`/ulasan?${params.toString()}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Fungsi untuk pagination yang mempertahankan filter rating
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Komponen Pagination
  const Pagination = ({ currentPage, totalItems, itemsPerPage }: { currentPage: number, totalItems: number, itemsPerPage: number }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) return null;
    
    // Tentukan rentang halaman yang akan ditampilkan
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    
    return (
      <div className="flex items-center justify-center gap-1 py-3">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
        >
          <span className="sr-only">Halaman pertama</span>
          <span>&laquo;</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <span className="sr-only">Halaman sebelumnya</span>
          <span>&lsaquo;</span>
        </Button>
        
        {startPage > 1 && (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 w-7 p-0"
              onClick={() => handlePageChange(1)}
            >
              1
            </Button>
            {startPage > 2 && <span className="text-xs text-muted-foreground">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <Button 
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm" 
            className="h-7 w-7 p-0"
            onClick={() => handlePageChange(page)}
          >
            {page}
          </Button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-xs text-muted-foreground">...</span>}
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 w-7 p-0"
              onClick={() => handlePageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <span className="sr-only">Halaman berikutnya</span>
          <span>&rsaquo;</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <span className="sr-only">Halaman terakhir</span>
          <span>&raquo;</span>
        </Button>
      </div>
    );
  };

  // Fungsi untuk filter komentar berdasarkan produk dan rating
  const getFilteredComments = useCallback((rating?: number) => {
    // Filter berdasarkan produk yang dipilih (jika ada)
    const commentsByItem = selectedItemId 
      ? allComments.filter(comment => comment.item_id.toString() === selectedItemId)
      : allComments;
      
    // Kemudian filter berdasarkan rating (jika ada)
    return rating
      ? commentsByItem.filter(comment => comment.rating_star === rating)
      : commentsByItem;
  }, [allComments, selectedItemId]);

  // Lazy-load detail produk untuk komentar yang sekarang ditampilkan
  useEffect(() => {
    if (allComments.length > 0 && selectedShopId) {
      // Ambil komentar yang ditampilkan di halaman saat ini
      const filteredComments = getFilteredComments(currentRating);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const visibleComments = filteredComments.slice(startIndex, endIndex);
      
      // Fetch detail produk hanya untuk komentar yang terlihat
      fetchProductDetails(visibleComments);
    }
  }, [currentPage, selectedShopId, currentRating, allComments, getFilteredComments, fetchProductDetails, itemsPerPage]);

  // Component untuk rating bintang
  const RatingStars = ({ rating }: { rating: number }) => {
    return (
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <StarFilledIcon
            key={i}
            className={`h-4 w-4 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  // Komponen untuk CommentCard
  const CommentCard = ({
    comment,
    productDetail,
    selectedShopId
  }: {
    comment: CommentItem;
    productDetail?: ProductDetail;
    selectedShopId: string | null;
  }) => {
    // Pindahkan state ke dalam komponen untuk mencegah re-render yang tidak perlu
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const productModelName = getModelName(comment, productDetail);
    
    // Tombol balas hanya ditampilkan jika belum ada balasan (baik dari API maupun lokal)
    const canReply = !comment.reply && !comment.comment_reply;

    // Fungsi untuk mengirim balasan, dipindahkan ke dalam komponen
    const handleSubmitReply = async () => {
      if (!selectedShopId || !replyText.trim()) return;
      
      try {
        setIsReplying(true);
        
        const response = await fetch('/api/ulasan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop_id: parseInt(selectedShopId),
            comment_list: [
              {
                comment_id: comment.comment_id,
                comment: replyText
              }
            ]
          }),
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'Gagal membalas komentar');
        }
        
        // Perbarui komentar di state
        setAllComments(prevComments => 
          prevComments.map(c => 
            c.comment_id === comment.comment_id 
              ? { 
                  ...c, 
                  reply: { 
                    reply_id: Date.now(), // ID sementara
                    comment: replyText,
                    create_time: Math.floor(Date.now() / 1000) 
                  } 
                } 
              : c
          )
        );
        
        // Reset state 
        setReplyText('');
        setIsReplying(false);
        setCurrentReplyCommentId(null);
        setReplySuccess(true);
        
        // Sembunyikan notifikasi sukses setelah beberapa detik
        setTimeout(() => {
          setReplySuccess(false);
        }, 3000);
        
      } catch (err) {
        console.error('Error replying to comment:', err);
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat membalas komentar');
      } finally {
        setIsReplying(false);
      }
    };
    
    return (
      <Card key={comment.comment_id} className="shadow-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden transition-all hover:shadow-md h-full flex flex-col">
        <CardHeader className="py-3 px-4 bg-zinc-50/80 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="bg-gradient-to-br from-primary/80 to-primary rounded-full h-8 w-8 flex items-center justify-center shadow-sm">
                  <span className="text-xs font-bold text-white">{comment.buyer_username.charAt(0).toUpperCase()}</span>
                </div>
                {comment.rating_star === 5 && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-white dark:border-zinc-800">
                    <StarFilledIcon className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-none">{comment.buyer_username}</p>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200">
                    #{comment.order_sn.slice(-6)}
                  </Badge>
                </div>
                <div className="flex items-center text-muted-foreground mt-0.5">
                  <span className="text-[10px]">{formatDate(comment.create_time)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <StarFilledIcon
                    key={i}
                    className={`h-3 w-3 ${i < comment.rating_star ? 'text-yellow-400' : 'text-zinc-200 dark:text-zinc-700'}`}
                  />
                ))}
              </div>
              {canReply && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-[10px] mt-1 text-muted-foreground hover:text-primary hover:bg-transparent"
                  onClick={() => setCurrentReplyCommentId(comment.comment_id)}
                >
                  Balas
                </Button>
              )}
              {!canReply && (
                <span className="text-[10px] text-muted-foreground mt-1">
                  Telah dibalas
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 flex-1 flex flex-col">
          {/* Informasi produk */}
          {productDetail && (
            <div className="flex items-center p-3 pb-0 gap-3">
              <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0 border shadow-sm">
                <Image
                  src={productDetail.image?.image_url_list?.[0] || '/placeholder-product.png'}
                  alt={productDetail.item_name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Link 
                  href={`/produk/edit?shop_id=${selectedShopId}&item_id=${comment.item_id}`} 
                  className="hover:text-primary transition-colors"
                >
                  <p className="text-xs font-medium line-clamp-1">{productDetail.item_name}</p>
                </Link>
                {productModelName && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] h-4 px-1 rounded-sm bg-transparent border-zinc-200 dark:border-zinc-800">
                      {productModelName}
                    </Badge>
                  </div>
                )}
                {(productDetail.item_sku || getModelSku(comment, productDetail)) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    SKU: <span className="font-mono">{getModelSku(comment, productDetail) || productDetail.item_sku}</span>
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Content ulasan */}
          <div className="px-4 py-3 flex-1">
            {comment.comment ? (
              <p className="text-sm line-clamp-3">{comment.comment}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 py-1">
                Pembeli tidak meninggalkan ulasan
              </p>
            )}
          </div>
          
          {/* Balasan dari API (dalam comment_reply) */}
          {comment.comment_reply && (
            <div className="px-4 py-2 bg-muted/30 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-1 mb-1">
                <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 bg-primary/10 text-primary border-none">
                  Balasan Anda
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(comment.comment_reply.create_time)}
                </span>
              </div>
              <p className="text-xs">{comment.comment_reply.reply}</p>
            </div>
          )}
          
          {/* Balasan lokal (dalam reply, hanya jika tidak ada comment_reply) */}
          {comment.reply && !comment.comment_reply && (
            <div className="px-4 py-2 bg-muted/30 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-1 mb-1">
                <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 bg-primary/10 text-primary border-none">
                  Balasan Anda
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(comment.reply.create_time)}
                </span>
              </div>
              <p className="text-xs">{comment.reply.comment}</p>
            </div>
          )}
          
          {/* Form balasan */}
          {currentReplyCommentId === comment.comment_id && (
            <div className="px-4 py-3 bg-muted/30 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`reply-${comment.comment_id}`} className="text-xs font-medium">
                  Balas Komentar
                </Label>
                <Input
                  id={`reply-${comment.comment_id}`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Tulis balasan Anda di sini..."
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (replyText.trim()) {
                        handleSubmitReply();
                      }
                    }
                  }}
                />
                <div className="flex justify-end gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setCurrentReplyCommentId(null);
                      setReplyText('');
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSubmitReply}
                    disabled={isReplying || !replyText.trim()}
                  >
                    {isReplying ? (
                      <>
                        <ReloadIcon className="mr-1 h-3 w-3 animate-spin" />
                        Mengirim
                      </>
                    ) : (
                      'Kirim Balasan'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Foto ulasan */}
          {comment.media.image_url_list && comment.media.image_url_list.length > 0 && (
            <div className="px-4 pb-4 mt-auto">
              <p className="text-[10px] font-medium text-muted-foreground mb-2">Foto Ulasan:</p>
              <div className="grid grid-cols-4 gap-1">
                {comment.media.image_url_list.slice(0, 4).map((url: string, idx: number) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden border shadow-sm group">
                    <Image
                      src={url}
                      alt={`Foto ulasan ${idx + 1}`}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 768px) 60px, 80px"
                    />
                  </div>
                ))}
                {comment.media.image_url_list.length > 4 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white rounded-full text-[10px] px-1.5 py-0.5">
                    +{comment.media.image_url_list.length - 4}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => setError(null)}
          >
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-2 sm:px-6">
      <div className="flex flex-col">
        {replySuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded mb-4 flex items-center justify-between">
            <span>Balasan berhasil dikirim!</span>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setReplySuccess(false)}>
              ✕
            </Button>
          </div>
        )}
        
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Komentar Produk</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Lihat dan filter komentar dari pelanggan untuk produk Anda
            </p>
          </div>
          
          {selectedItemId && (
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="h-8">
              Reset Filter
            </Button>
          )}
        </div>
        
        <div className="bg-card rounded-lg border shadow-sm p-3 sm:p-4 mb-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
            <div className="w-full sm:w-[220px] md:w-[300px] flex items-center gap-2">
              <Label htmlFor="shop-select" className="text-xs font-medium min-w-14">Toko</Label>
              <Select 
                value={selectedShopId || ''} 
                onValueChange={handleShopChange}
                disabled={loadingShops}
              >
                <SelectTrigger id="shop-select" className="h-9 w-full text-xs sm:text-sm truncate max-w-full">
                  <SelectValue placeholder="Pilih toko" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {loadingShops ? (
                    <div className="flex items-center justify-center p-2">
                      <ReloadIcon className="h-3 w-3 animate-spin mr-2" />
                      <span className="text-sm">Memuat...</span>
                    </div>
                  ) : shops.length === 0 ? (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      Tidak ada toko yang tersedia
                    </div>
                  ) : (
                    <SelectGroup>
                      <SelectLabel className="text-xs">Toko Anda</SelectLabel>
                      {shops.map(shop => (
                        <SelectItem key={shop.shop_id} value={shop.shop_id.toString()} className="truncate">
                          {shop.shop_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full sm:w-[180px] md:w-[200px] flex items-center gap-2">
              <Label htmlFor="product-select" className="text-xs font-medium min-w-14">Produk</Label>
              <Select 
                value={selectedItemId || "_all"} 
                onValueChange={handleItemChange}
                disabled={loadingProducts || !selectedShopId}
              >
                <SelectTrigger id="product-select" className="h-9 w-full text-xs sm:text-sm truncate max-w-full">
                  <SelectValue placeholder="Semua produk" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {loadingProducts ? (
                    <div className="flex items-center justify-center p-2">
                      <ReloadIcon className="h-3 w-3 animate-spin mr-2" />
                      <span className="text-sm">Memuat...</span>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      Tidak ada produk yang tersedia
                    </div>
                  ) : (
                    <SelectGroup>
                      <SelectItem value="_all" className="text-sm">Semua produk</SelectItem>
                      {products.map(product => (
                        <SelectItem key={product.item_id} value={product.item_id.toString()} className="text-sm truncate">
                          {product.item_sku ? (
                            <span className="font-mono">{product.item_sku}</span>
                          ) : (
                            product.item_name.substring(0, 25) + (product.item_name.length > 25 ? '...' : '')
                          )}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full sm:w-auto flex-1 sm:pl-1 md:pl-2">
              <div className="flex gap-1.5 sm:gap-2 h-8 sm:h-9">
                <Button 
                  variant={currentRating === undefined ? "default" : "outline"} 
                  size="sm" 
                  className={`px-1.5 sm:px-2 h-full text-xs ${currentRating === undefined ? "bg-primary text-primary-foreground border-primary shadow-sm" : ""}`}
                  onClick={() => {
                    setCurrentRating(undefined);
                    setCurrentPage(1);
                  }}
                >
                  <span>Semua</span>
                  <Badge className="ml-1 sm:ml-1.5 bg-primary-foreground/20 text-primary-foreground border-none text-[10px] sm:text-xs py-0 px-1 sm:px-1.5">
                    {getCommentCountByRating()}
                  </Badge>
                </Button>
                
                <Button 
                  variant={currentRating === 5 ? "default" : "outline"} 
                  size="sm" 
                  className={`px-1.5 sm:px-2 h-full text-xs ${currentRating === 5 ? "bg-primary text-primary-foreground border-primary shadow-sm" : ""}`}
                  onClick={() => {
                    setCurrentRating(5);
                    setCurrentPage(1);
                  }}
                >
                  <span className="flex items-center">
                    5 <StarFilledIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5 text-yellow-400"/>
                  </span>
                  <Badge className={`ml-1 sm:ml-1.5 border-none text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 ${currentRating === 5 ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    {getCommentCountByRating(5)}
                  </Badge>
                </Button>
                
                <Button 
                  variant={currentRating === 4 ? "default" : "outline"} 
                  size="sm" 
                  className={`px-1.5 sm:px-2 h-full text-xs ${currentRating === 4 ? "bg-primary text-primary-foreground border-primary shadow-sm" : ""}`}
                  onClick={() => {
                    setCurrentRating(4);
                    setCurrentPage(1);
                  }}
                >
                  <span className="flex items-center">
                    4 <StarFilledIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5 text-yellow-400"/>
                  </span>
                  <Badge className={`ml-1 sm:ml-1.5 border-none text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 ${currentRating === 4 ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    {getCommentCountByRating(4)}
                  </Badge>
                </Button>
                
                <Button 
                  variant={currentRating === 3 ? "default" : "outline"} 
                  size="sm" 
                  className={`px-1.5 sm:px-2 h-full text-xs ${currentRating === 3 ? "bg-primary text-primary-foreground border-primary shadow-sm" : ""}`}
                  onClick={() => {
                    setCurrentRating(3);
                    setCurrentPage(1);
                  }}
                >
                  <span className="flex items-center">
                    3 <StarFilledIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5 text-yellow-400"/>
                  </span>
                  <Badge className={`ml-1 sm:ml-1.5 border-none text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 ${currentRating === 3 ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    {getCommentCountByRating(3)}
                  </Badge>
                </Button>
                
                <Button 
                  variant={currentRating === 2 ? "default" : "outline"} 
                  size="sm" 
                  className={`px-1.5 sm:px-2 h-full text-xs ${currentRating === 2 ? "bg-primary text-primary-foreground border-primary shadow-sm" : ""}`}
                  onClick={() => {
                    setCurrentRating(2);
                    setCurrentPage(1);
                  }}
                >
                  <span className="flex items-center">
                    2 <StarFilledIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5 text-yellow-400"/>
                  </span>
                  <Badge className={`ml-1 sm:ml-1.5 border-none text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 ${currentRating === 2 ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    {getCommentCountByRating(2)}
                  </Badge>
                </Button>
                
                <Button 
                  variant={currentRating === 1 ? "default" : "outline"} 
                  size="sm" 
                  className={`px-1.5 sm:px-2 h-full text-xs ${currentRating === 1 ? "bg-primary text-primary-foreground border-primary shadow-sm" : ""}`}
                  onClick={() => {
                    setCurrentRating(1);
                    setCurrentPage(1);
                  }}
                >
                  <span className="flex items-center">
                    1 <StarFilledIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5 text-yellow-400"/>
                  </span>
                  <Badge className={`ml-1 sm:ml-1.5 border-none text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 ${currentRating === 1 ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    {getCommentCountByRating(1)}
                  </Badge>
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="h-[calc(100vh-280px)] sm:h-[calc(100vh-256px)] overflow-y-auto pr-1">
          {renderCommentsList(currentRating)}
        </div>
      </div>
    </div>
  );

  // Fungsi untuk fetch semua komentar sampai tidak ada lagi
  function renderCommentsList(rating?: number): JSX.Element {
    // Filter semua komentar berdasarkan rating dan item terlebih dahulu
    const filteredAllComments = getFilteredComments(rating);
    
    // Hitung total untuk pagination
    const totalFilteredComments = filteredAllComments.length;
    
    // Terapkan pagination setelah filtering
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedComments = filteredAllComments.slice(startIndex, endIndex);
    
    if (loadingComments && !isFetchingAllComments && paginatedComments.length === 0) {
      // Skeleton loading
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-none border">
              <CardContent className="p-3">
                <div className="flex items-start gap-3 pt-1">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-1/4" />
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }
    
    if (isFetchingAllComments) {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <ReloadIcon className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Mengambil semua data komentar...</p>
        </div>
      );
    }
    
    if (!loadingComments && paginatedComments.length === 0) {
      // Empty state
      return (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <InfoCircledIcon className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">
            {rating 
              ? `Tidak ada komentar dengan rating ${rating} bintang`
              : 'Tidak ada komentar yang tersedia'}
          </p>
          {selectedItemId && (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleResetFilters}>
              Lihat semua produk
            </Button>
          )}
        </div>
      );
    }
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {paginatedComments.map((comment: CommentItem) => (
            <CommentCard
              key={comment.comment_id}
              comment={comment}
              productDetail={productsDetails[comment.item_id]}
              selectedShopId={selectedShopId}
            />
          ))}
        </div>
        
        {/* Pagination */}
        <Pagination 
          currentPage={currentPage}
          totalItems={totalFilteredComments}
          itemsPerPage={itemsPerPage}
        />
      </>
    );
  }

  // Fungsi helper untuk mendapatkan nama model dari comment
  function getModelName(comment: CommentItem, productDetail?: ProductDetail): string | null {
    if (!productDetail || !productDetail.models) return null;
    
    // Jika ada model_id_list pada komentar, cari model yang sesuai
    if (comment.model_id_list && comment.model_id_list.length > 0) {
      const model = productDetail.models.find(m => comment.model_id_list.includes(m.model_id));
      return model?.model_name || null;
    }
    
    // Jika ada model_id pada komentar, cari model yang sesuai
    if (comment.model_id) {
      const model = productDetail.models.find(m => m.model_id === comment.model_id);
      return model?.model_name || null;
    }
    
    return null;
  }

  // Fungsi helper untuk mendapatkan SKU model dari comment
  function getModelSku(comment: CommentItem, productDetail?: ProductDetail): string | null {
    if (!productDetail || !productDetail.models) return null;
    
    // Jika ada model_id_list pada komentar, cari model yang sesuai
    if (comment.model_id_list && comment.model_id_list.length > 0) {
      const model = productDetail.models.find(m => comment.model_id_list.includes(m.model_id));
      return model?.model_sku || null;
    }
    
    // Jika ada model_id pada komentar, cari model yang sesuai
    if (comment.model_id) {
      const model = productDetail.models.find(m => m.model_id === comment.model_id);
      return model?.model_sku || null;
    }
    
    return null;
  }
} 