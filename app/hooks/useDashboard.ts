import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase"
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';



export type OrderItem = {
  [key: string]: any;
}

export type DashboardSummary = {
  pesananPerToko: Record<string, number>;
  omsetPerToko: Record<string, number>;
  totalOrders: number;
  totalOmset: number;
  totalIklan: number;
  iklanPerToko: { [key: string]: number }
}

export type DashboardData = {
  summary: DashboardSummary;
  orders: OrderItem[];
}
const trackedStatuses = ['READY_TO_SHIP', 'PROCESSED', 'TO_RETURN', 'IN_CANCEL', 'CANCELLED', 'SHIPPED'];
const timeZone = 'Asia/Jakarta';

const status_yang_dihitung = ['IN_CANCEL', 'PROCESSED', 'READY_TO_SHIP', 'SHIPPED'];

const processOrder = (order: OrderItem, summary: DashboardSummary) => {
  const payDate = toZonedTime(new Date(order.pay_time * 1000), timeZone);
  const orderDate = format(payDate, 'yyyy-MM-dd');
  const today = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

  if (orderDate === today && status_yang_dihitung.includes(order.order_status)) {
    summary.totalOrders++;
    summary.totalOmset += order.total_amount;

    const toko = order.shop_name || 'Tidak diketahui';
    summary.pesananPerToko[toko] = (summary.pesananPerToko[toko] || 0) + 1;
    summary.omsetPerToko[toko] = (summary.omsetPerToko[toko] || 0) + order.total_amount;
  }
};

async function getOrderDetails(order_sn: string, shop_id: string, retries = 3): Promise<any | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data, error } = await supabase.rpc('get_sku_qty_and_total_price', { 
        order_sn_input: order_sn,
        shop_id_input: shop_id
      });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return null;
      }
      
      return data[0];
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
  const FETCH_INTERVAL = 60000; // 1 menit dalam milidetik
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik
  const LAST_FETCH_KEY = 'ads_last_fetch_time';
  const CACHED_ADS_DATA_KEY = 'cached_ads_data';

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    summary: {
      pesananPerToko: {},
      omsetPerToko: {},
      totalOrders: 0,
      totalOmset: 0,
      totalIklan: 0,
      iklanPerToko: {}
    },
    orders: []
  }); 

  const createOrderSubscription = () => {
    return supabase
      .channel('orders')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `order_status=in.(${trackedStatuses.join(',')})`
      }, async (payload) => {
        const newOrder = payload.new as OrderItem;
        
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
                summary: newSummary,
                orders: updatedOrders
              };
            }
          });

          try {
            const orderDetails = await getOrderDetails(newOrder.order_sn, newOrder.shop_id);
            console.log('Detail pesanan diterima:', orderDetails);
            
            if (orderDetails) {
              setDashboardData(prevData => {
                const updatedOrders = prevData.orders.map(order => 
                  order.order_sn === newOrder.order_sn 
                    ? { ...order, ...orderDetails, total_amount: orderDetails.total_price ?? order.total_amount }
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
            const existingOrderIndex = prevData.orders.findIndex(order => order.order_sn === newOrder.order_sn);
            
            if (existingOrderIndex !== -1) {
              const updatedOrders = [...prevData.orders];
              updatedOrders[existingOrderIndex] = {
                ...updatedOrders[existingOrderIndex],
                order_status: newOrder.order_status,
                shipping_carrier: newOrder.shipping_carrier
              };
              
              const newSummary = {
                pesananPerToko: {},
                omsetPerToko: {},
                totalOrders: 0,
                totalOmset: 0,
                totalIklan: prevData.summary.totalIklan,
                iklanPerToko: prevData.summary.iklanPerToko
              };
              updatedOrders.forEach(order => processOrder(order, newSummary));

              if (newSummary.totalOrders !== prevData.summary.totalOrders ||
                  newSummary.totalOmset !== prevData.summary.totalOmset) {
                return {
                  summary: newSummary,
                  orders: updatedOrders
                };
              } else {
                return {
                  ...prevData,
                  orders: updatedOrders
                };
              }
            } else {
              return prevData;
            }
          });
        }
      });
  };

  const createLogisticSubscription = () => {
    return supabase
      .channel('logistic-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'logistic',
          
        },
        (payload) => {
          const logisticData = payload.new;
          
          setDashboardData(prevData => {
            const updatedOrders = prevData.orders.map(order => {
              if (order.order_sn === logisticData.order_sn) {
                return {
                  ...order,
                  tracking_number: logisticData.tracking_number,
                  document_status: logisticData.document_status
                };
              }
              return order;
            });

            if (JSON.stringify(updatedOrders) !== JSON.stringify(prevData.orders)) {
              return {
                ...prevData,
                orders: updatedOrders
              };
            }

            return prevData;
          });
        }
      );
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: orders, error } = await supabase
        .from('dashboard_view')
        .select('*');

      if (error) {
        throw new Error('Gagal mengambil data dari dashboard_view');
      }

      const processOrders = async () => {
        for (const order of orders) {
          if (
            order.order_status === 'PROCESSED' && 
            order.document_status !== 'READY' ||
            order.status === 'PROCESSED' &&
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

      await processOrders();

      const summary: DashboardSummary = {
        pesananPerToko: {},
        omsetPerToko: {},
        totalOrders: 0,
        totalOmset: 0,
        totalIklan: 0,
        iklanPerToko: {}
      };

      orders.forEach(order => processOrder(order, summary));

      setDashboardData({ summary, orders });

      const adsData = await fetchAdsData();
      if (adsData) {
        setDashboardData(prevData => {
          const newSummary = { ...prevData.summary };
          newSummary.totalIklan = parseFloat(adsData.total_cost.replace('Rp. ', '').replace('.', '').replace(',', '.'));
          newSummary.iklanPerToko = {};
          adsData.ads_data.forEach((ad: AdData) => {
            newSummary.iklanPerToko[ad.shop_name] = parseFloat(ad.cost.replace('Rp. ', '').replace('.', '').replace(',', '.'));
          });
          return {
            ...prevData,
            summary: newSummary
          };
        });
      }
    };

    fetchInitialData();

    // Buat subscription awal
    const channels = {
      orderChannel: createOrderSubscription(),
      logisticChannel: createLogisticSubscription()
    };

    // Subscribe ke channel
    channels.orderChannel.subscribe((status) => {
      console.log(`Status koneksi orders: ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log('Berhasil berlangganan ke perubahan orders');
      }
    });

    channels.logisticChannel.subscribe((status) => {
      console.log(`Status koneksi logistic: ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log('Berhasil berlangganan ke perubahan logistic');
      }
    });

    // Tambahkan ping interval untuk menjaga koneksi tetap aktif
    const pingInterval = setInterval(() => {
      channels.orderChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: {}
      });
      channels.logisticChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: {}
      });
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      channels.orderChannel.unsubscribe();
      channels.logisticChannel.unsubscribe();
    };
  }, []);

  const fetchAdsData = async () => {
    const now = Date.now();
    const lastFetch = Number(localStorage.getItem(LAST_FETCH_KEY)) || 0;

    // Hapus data yang sudah lebih dari 24 jam
    if (now - lastFetch > MAX_AGE) {
      localStorage.removeItem(LAST_FETCH_KEY);
      localStorage.removeItem(CACHED_ADS_DATA_KEY);
    }

    if (now - lastFetch < FETCH_INTERVAL) {
      // Kembalikan data yang tersimpan di cache
      const cachedData = localStorage.getItem(CACHED_ADS_DATA_KEY);
      return cachedData ? JSON.parse(cachedData) : null;
    }

    try {
      localStorage.setItem(LAST_FETCH_KEY, now.toString());
      const response = await fetch(`/api/ads?_timestamp=${now}`);
      if (!response.ok) {
        throw new Error('Gagal mengambil data iklan');
      }
      const data = await response.json();
      // Simpan data ke cache
      localStorage.setItem(CACHED_ADS_DATA_KEY, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('Error saat mengambil data iklan:', error);
      return null;
    }
  };

  return dashboardData;
};

interface AdData {
  shop_name: string;
  cost: string;
}
