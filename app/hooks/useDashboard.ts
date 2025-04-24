import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client'
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useUserData } from '@/contexts/UserDataContext';

export type OrderItem = {
  [key: string]: any;
}

export type Shop = {
  shop_id: number;
  shop_name: string;
}

export type Order = {
  order_sn: string;
  shop_id: number;
  shop_name: string;
  order_status: string;
  buyer_user_id: number;
  create_time: number;
  update_time: number;
  ship_by_date: number;
  pay_time: number;
  buyer_username: string;
  escrow_amount_after_adjustment: number;
  shipping_carrier: string;
  cod: boolean;
  tracking_number?: string;
  document_status?: string;
  is_printed?: boolean;
  items: Array<{
    model_quantity_purchased: number;
    model_discounted_price: number;
    model_name: string;
    item_sku: string;
  }>;
}

export type DashboardSummary = {
  pesananPerToko: Record<string, number>;
  omsetPerToko: Record<string, number>;
  totalOrders: number;
  totalOmset: number;
  totalIklan: number;
  iklanPerToko: Record<string, number>;
}

export type DashboardData = {
  summary: DashboardSummary;
  orders: Order[];
  shops?: any[]; // Tambahkan shops untuk menyimpan data toko
}

const trackedStatuses = ['READY_TO_SHIP', 'PROCESSED', 'TO_RETURN', 'IN_CANCEL', 'CANCELLED', 'SHIPPED'];
const timeZone = 'Asia/Jakarta';

const status_yang_dihitung = ['IN_CANCEL', 'PROCESSED', 'READY_TO_SHIP', 'SHIPPED'];

const calculateOrderTotal = (order: Order): number => {
  return order.items?.reduce((total, item) => 
    total + (item.model_quantity_purchased * item.model_discounted_price), 
  0) || 0;
};

const processOrder = (order: Order, summary: DashboardSummary) => {
  const payDate = toZonedTime(new Date(order.pay_time * 1000), timeZone);
  const orderDate = format(payDate, 'yyyy-MM-dd');
  const today = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

  if (orderDate === today && status_yang_dihitung.includes(order.order_status)) {
    summary.totalOrders++;
    summary.totalOmset += calculateOrderTotal(order);

    const toko = order.shop_name || 'Tidak diketahui';
    summary.pesananPerToko[toko] = (summary.pesananPerToko[toko] || 0) + 1;
    summary.omsetPerToko[toko] = (summary.omsetPerToko[toko] || 0) + calculateOrderTotal(order);
  }
};

async function getOrderDetails(order_sn: string, shop_id: string, retries = 3): Promise<any | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Hanya perlu ambil order_items, data tracking sudah ada di response API
      const { data: itemsData, error: itemsError } = await createClient()
        .from('order_items')
        .select('model_quantity_purchased, model_discounted_price, item_sku, model_name')
        .eq('order_sn', order_sn);
      
      if (itemsError) throw itemsError;
      
      if (!itemsData || itemsData.length === 0) {
        return null;
      }

      return {
        items: itemsData.map(item => ({
          model_quantity_purchased: parseInt(item.model_quantity_purchased || '0'),
          model_discounted_price: parseFloat(item.model_discounted_price || '0'),
          item_sku: item.item_sku,
          model_name: item.model_name
        }))
        // Tidak perlu ambil tracking data lagi karena sudah ada di response API
      };
    } catch (error) {
      if (attempt === retries - 1) {
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  return null;
}

export const useDashboard = () => {
  const FETCH_INTERVAL = 60000;
  const MAX_AGE = 24 * 60 * 60 * 1000;
  const LAST_FETCH_KEY = 'ads_last_fetch_time';
  const CACHED_ADS_DATA_KEY = 'cached_ads_data';
  const hasInitialFetch = useRef(false);

  // Menggunakan useUserData hook untuk mendapatkan daftar toko user
  const { shops } = useUserData();

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    summary: {
      pesananPerToko: {},
      omsetPerToko: {},
      totalOrders: 0,
      totalOmset: 0,
      totalIklan: 0,
      iklanPerToko: {}
    },
    orders: [],
    shops: []
  }); 

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createOrderSubscription = () => {
    // Mendapatkan daftar shop_id dari daftar toko user
    const userShopIds = shops.map(shop => shop.shop_id.toString());
    
    // Jika tidak ada toko, jangan buat subscription
    if (userShopIds.length === 0) {
      console.log('Tidak ada toko yang ditemukan, subscription tidak dibuat');
      return createClient().channel('orders-empty');
    }
    
    // Filter untuk shop_id in.(user shop ids) dan order_status in.(tracked statuses)
    // Format filter Supabase: "column=in.(val1,val2,val3)"
    const shopFilter = `shop_id=in.(${userShopIds.join(',')})`;
    
    
    return createClient()
      .channel('orders')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `${shopFilter}`,
      }, async (payload) => {
        const newOrder = payload.new as Order;
        
        // Verifikasi additional filter secara manual karena Supabase hanya mendukung
        // satu filter pada saat ini
        if (!trackedStatuses.includes(newOrder.order_status)) {
          return; // Lewati jika status tidak dalam daftar yang dipantau
        }
        
        // Tambahkan shop_name dari UserDataContext
        const shop = shops.find(s => s.shop_id === newOrder.shop_id);
        if (shop) {
          newOrder.shop_name = shop.shop_name;
        }
        
        if (newOrder.order_status === 'READY_TO_SHIP') {
          setDashboardData(prevData => {
            const existingOrderIndex = prevData.orders.findIndex(
              order => order.order_sn === newOrder.order_sn
            );

            const newSummary = { ...prevData.summary };
            processOrder(newOrder, newSummary);

            if (existingOrderIndex === -1) {
              console.log('Menambahkan pesanan baru ke daftar:', newOrder.order_sn);
              return {
                ...prevData,
                summary: newSummary,
                orders: [newOrder, ...prevData.orders]
              };
            } else {
              console.log('Memperbarui pesanan yang sudah ada:', newOrder.order_sn);
              const updatedOrders = [...prevData.orders];
              updatedOrders[existingOrderIndex] = {
                ...updatedOrders[existingOrderIndex],
                ...newOrder
              };
              return {
                ...prevData,
                summary: newSummary,
                orders: updatedOrders
              };
            }
          });

          try {
            const orderDetails = await getOrderDetails(newOrder.order_sn, newOrder.shop_id.toString());
            console.log('Detail pesanan diterima:', orderDetails);
            
            if (orderDetails) {
              setDashboardData(prevData => {
                const updatedOrders = prevData.orders.map(order => 
                  order.order_sn === newOrder.order_sn 
                    ? { 
                        ...order, 
                        ...newOrder, 
                        items: orderDetails.items
                        // Tidak lagi mengambil tracking_number, document_status, dan is_printed dari orderDetails
                      }
                    : order
                );
                
                const newSummary = {
                  pesananPerToko: {},
                  omsetPerToko: {},
                  totalOrders: 0,
                  totalOmset: 0,
                  totalIklan: prevData.summary.totalIklan,
                  iklanPerToko: prevData.summary.iklanPerToko
                };
                updatedOrders.forEach(order => processOrder(order, newSummary));

                return {
                  ...prevData,
                  summary: newSummary,
                  orders: updatedOrders
                };
              });
            }
          } catch (error) {
            console.error('Error saat mengambil detail pesanan:', error);
          }
        } else {
          setDashboardData(prevData => {
            const existingOrderIndex = prevData.orders.findIndex(order => 
              order.order_sn === newOrder.order_sn
            );
            
            if (existingOrderIndex !== -1) {
              const updatedOrders = [...prevData.orders];
              const oldOrder = updatedOrders[existingOrderIndex];
              
              // Update order dengan data baru
              updatedOrders[existingOrderIndex] = {
                ...oldOrder,
                order_status: newOrder.order_status,
                shipping_carrier: newOrder.shipping_carrier,
                escrow_amount_after_adjustment: newOrder.escrow_amount_after_adjustment,
                tracking_number: newOrder.tracking_number,
                document_status: newOrder.document_status,
              };

              // Hanya hitung ulang summary jika status berubah menjadi CANCELLED
              if (newOrder.order_status === 'CANCELLED') {
                const newSummary = {
                  pesananPerToko: {},
                  omsetPerToko: {},
                  totalOrders: 0,
                  totalOmset: 0,
                  totalIklan: prevData.summary.totalIklan,
                  iklanPerToko: prevData.summary.iklanPerToko
                };
                
                // Hitung ulang summary untuk semua order
                updatedOrders.forEach(order => processOrder(order, newSummary));

                return {
                  ...prevData,
                  summary: newSummary,
                  orders: updatedOrders
                };
              }

              // Jika bukan CANCELLED, hanya update orders tanpa hitung ulang summary
              return {
                ...prevData,
                orders: updatedOrders
              };
            }
            return prevData;
          });
        }
      });
  };

  // Fungsi untuk mengambil data iklan dari API
  const fetchAdsData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';
    
    // Tambahkan userId ke key untuk memisahkan cache per user
    const USER_LAST_FETCH_KEY = `ads_last_fetch_time_${userId}`;
    const USER_CACHED_ADS_DATA_KEY = `cached_ads_data_${userId}`;
    
    const now = Date.now();
    const lastFetch = Number(localStorage.getItem(USER_LAST_FETCH_KEY)) || 0;

    // Hapus data yang sudah lebih dari 24 jam
    if (now - lastFetch > MAX_AGE) {
      localStorage.removeItem(USER_LAST_FETCH_KEY);
      localStorage.removeItem(USER_CACHED_ADS_DATA_KEY);
    }

    if (now - lastFetch < FETCH_INTERVAL) {
      // Kembalikan data yang tersimpan di cache
      const cachedData = localStorage.getItem(USER_CACHED_ADS_DATA_KEY);
      return cachedData ? JSON.parse(cachedData) : null;
    }

    try {
      localStorage.setItem(USER_LAST_FETCH_KEY, now.toString());
      const response = await fetch(`/api/ads?_timestamp=${now}`);
      if (!response.ok) {
        throw new Error('Gagal mengambil data iklan');
      }
      const data = await response.json();
      // Simpan data ke cache
      localStorage.setItem(USER_CACHED_ADS_DATA_KEY, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('Error saat mengambil data iklan:', error);
      return null;
    }
  };

  // Fungsi untuk memproses shipping documents
  const processOrders = async (orders: Order[]) => {
    for (const order of orders) {
      if (
        order.order_status === 'PROCESSED' && 
        order.document_status !== 'READY' ||
        order.order_status === 'PROCESSED' &&
        order.tracking_number === null
      ) {
        console.log('Mencoba membuat shipping document untuk:', {
          order_sn: order.order_sn,
          shop_id: order.shop_id,
          status: order.order_status,
          document: order.document_status
        });
        
        try {
          // Cek tracking number terlebih dahulu
          if (!order.tracking_number) {
            const trackingResponse = await fetch(`/api/shipping-document/create_document?get_tracking=true`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                shopId: order.shop_id,
                order_sn: order.order_sn
              })
            });

            if (!trackingResponse.ok) {
              throw new Error(`HTTP error! status: ${trackingResponse.status}`);
            }

            const trackingData = await trackingResponse.json();
            if (trackingData.success) {
              order.tracking_number = trackingData.data.tracking_number;
              
              // Perbarui state dengan tracking number baru
              setDashboardData(prevData => ({
                ...prevData,
                orders: prevData.orders.map(existingOrder => 
                  existingOrder.order_sn === order.order_sn 
                    ? { ...existingOrder, tracking_number: trackingData.data.tracking_number }
                    : existingOrder
                )
              }));
            }
          }

          // Buat shipping document dengan tracking number yang sudah ada
          const response = await fetch('/api/shipping-document/create_document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: order.shop_id,
              order_sn: order.order_sn,
              tracking_number: order.tracking_number
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('Gagal membuat shipping document:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }

          // Tambahkan pembaruan state setelah dokumen berhasil dibuat
          const documentData = await response.json();
          if (documentData.success) {
            setDashboardData(prevData => ({
              ...prevData,
              orders: prevData.orders.map(existingOrder => 
                existingOrder.order_sn === order.order_sn 
                  ? { ...existingOrder, document_status: 'READY' }
                  : existingOrder
              )
            }));
          }
        } catch (error) {
          console.error('Error untuk order:', order.order_sn, error);
        }
      }
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Mengambil data dashboard dari API...');
        
        // 1. Ambil data dashboard dari API
        const dashboardResponse = await fetch('/api/dashboard');
        if (!dashboardResponse.ok) {
          throw new Error(`Error fetching dashboard: ${dashboardResponse.status}`);
        }
        
        const dashboardResult = await dashboardResponse.json();
        if (!dashboardResult.success) {
          throw new Error(dashboardResult.message || 'Gagal mengambil data dashboard');
        }
        
        // 2. Ekstrak data dari respons
        const { orders, shops } = dashboardResult.data;
        
        // Tambahkan shop_name ke setiap order jika belum ada
        const ordersWithShopName = orders.map((order: Order) => {
          // Jika order sudah memiliki shop_name, gunakan yang ada
          if (order.shop_name) {
            return order;
          }
          
          // Cari shop_name dari UserDataContext
          const shop = shops.find((s: Shop) => s.shop_id === order.shop_id);
          if (shop) {
            return {
              ...order,
              shop_name: shop.shop_name
            };
          }
          
          return order;
        });
        
        // 3. Hitung summary dari data mentah
        const newSummary: DashboardSummary = {
          pesananPerToko: {},
          omsetPerToko: {},
          totalOrders: 0,
          totalOmset: 0,
          totalIklan: 0,
          iklanPerToko: {}
        };

        // Inisialisasi data per toko
        shops.forEach((shop: Shop) => {
          newSummary.pesananPerToko[shop.shop_name] = 0;
          newSummary.omsetPerToko[shop.shop_name] = 0;
        });

        // Proses setiap order untuk summary
        ordersWithShopName.forEach((order: Order) => {
          const payDate = toZonedTime(new Date(order.pay_time * 1000), timeZone);
          const orderDate = format(payDate, 'yyyy-MM-dd');
          const today = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

          if (orderDate === today && status_yang_dihitung.includes(order.order_status)) {
            newSummary.totalOrders++;
            newSummary.totalOmset += calculateOrderTotal(order);

            const toko = order.shop_name || 'Tidak diketahui';
            newSummary.pesananPerToko[toko] = (newSummary.pesananPerToko[toko] || 0) + 1;
            newSummary.omsetPerToko[toko] = (newSummary.omsetPerToko[toko] || 0) + calculateOrderTotal(order);
          }
        });

        // 4. Set data dashboard dengan summary yang baru dihitung
        setDashboardData({
          summary: newSummary,
          orders: ordersWithShopName,
          shops: shops
        });
        
        // 5. Proses orders untuk shipping documents jika diperlukan
        await processOrders(ordersWithShopName || []);
        
        // 6. Ambil data iklan dari API terpisah
        console.log('Mengambil data iklan...');
        const adsData = await fetchAdsData();
        
        if (adsData) {
          console.log('Data iklan berhasil diambil');
          
          // 7. Update dashboard dengan data iklan
          setDashboardData(prevData => {
            const newSummary = { ...prevData.summary };
            
            // Parse total cost - hapus desimal
            if (adsData.raw_total_cost) {
              // Gunakan raw_total_cost jika tersedia
              newSummary.totalIklan = Math.floor(adsData.raw_total_cost);
            } else {
              // Jika tidak, parse dari string dan bulatkan ke bawah
              const parsedValue = parseFloat(adsData.total_cost.replace('Rp. ', '').replace(/\./g, '').replace(',', '.'));
              newSummary.totalIklan = Math.floor(parsedValue);
            }
            
            // Parse data iklan per toko - juga hapus desimal
            adsData.ads_data.forEach((ad: AdData) => {
              let cost;
              if (ad.raw_cost) {
                cost = Math.floor(ad.raw_cost);
              } else {
                cost = Math.floor(parseFloat(ad.cost.replace('Rp. ', '').replace(/\./g, '').replace(',', '.')));
              }
              newSummary.iklanPerToko[ad.shop_name] = cost;
            });
            
            return {
              ...prevData,
              summary: newSummary
            };
          });
        }
        
      } catch (error) {
        console.error('Error saat mengambil data dashboard:', error);
        setError(error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui');
      } finally {
        setIsLoading(false);
      }
    };

    // Pisahkan logika subscription
    const setupSubscription = () => {
      if (shops.length > 0) {
        const orderChannel = createOrderSubscription();

        orderChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Berhasil berlangganan ke perubahan orders untuk toko user');
          }
        });

        const pingInterval = setInterval(() => {
          orderChannel.send({
            type: 'broadcast',
            event: 'ping',
            payload: {}
          });
        }, 30000);

        return () => {
          clearInterval(pingInterval);
          orderChannel.unsubscribe();
        };
      }
    };

    if (!hasInitialFetch.current) {
      hasInitialFetch.current = true;
      fetchDashboardData();
    }

    return setupSubscription();
  }, [shops]);

  const refreshData = () => {
    // Tambahkan fungsi untuk refresh data manual jika diperlukan
    console.log('Memuat ulang data dashboard...');
    window.location.reload(); // Cara sederhana, bisa diganti dengan implementasi yang lebih canggih
  };

  return {
    ...dashboardData,
    isLoading,
    error,
    refreshData
  };
};

interface AdData {
  shop_name: string;
  shop_id: number | string;
  cost: string;
  raw_cost?: number;
}