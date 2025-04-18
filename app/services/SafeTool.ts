// Types
export interface FlashSaleIssue {
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

export interface DiscountIssue {
  shops_without_backup: Array<{
    shop_name: string;
    shop_id: number;
    ongoing_discounts: Array<any>;
  }>;
  ending_soon: Array<{
    shop_name: string;
    shop_id: number;
    discounts: Array<any>;
  }>;
  expired_without_ongoing: Array<{
    shop_name: string;
    shop_id: number;
    discount: any;
  }>;
}

export interface OpenAICheckResult {
  success: boolean;
  message: string;
}

export interface ShopHealthResponse {
  success: boolean;
  data?: {
    flashSaleIssues: FlashSaleIssue[];
    discountIssues: DiscountIssue;
    returnIssues: ReturnIssue[];
    summary: {
      totalIssues: number;
      criticalShops: CriticalShop[];
    };
  };
  message?: string;
}

interface CriticalShop {
  shop_id: number;
  shop_name: string;
  issues: string[];
}

export interface ReturnIssue {
  return_sn: string;
  order_sn: string;
  reason: string;
  text_reason: string;
  create_time: number;
  status: string;
  return_solution: number;
  refund_amount: number;
  shop_id: number;
  user: {
    username: string;
    email: string;
  };
  item: Array<{
    name: string;
    item_sku: string;
    amount: number;
    refund_amount: number;
  }>;
}

// Constants
const API_ENDPOINTS = {
  flashSale: 'http://localhost:10000/api/flashsale/cek-fs',
  discount: 'http://localhost:10000/api/discount/cek-diskon',
  shops: 'http://localhost:10000/api/shops'
} as const;

// Helper Functions
function processFlashSaleIssues(flashSaleData: FlashSaleIssue[]): CriticalShop[] {
  return flashSaleData.reduce<CriticalShop[]>((criticalShops, issue) => {
    const shopIssues: string[] = [];

    if (issue.issues.no_active_flashsale) {
      shopIssues.push('Tidak ada Flash Sale aktif');
    }
    if (issue.issues.inactive_current > 0) {
      shopIssues.push(`${issue.issues.inactive_current} Flash Sale aktif tidak memiliki produk`);
    }
    if (issue.issues.upcoming_count < 3) {
      shopIssues.push('Kurang dari 3 Flash Sale mendatang');
    }
    if (issue.issues.inactive_upcoming > 0) {
      shopIssues.push(`${issue.issues.inactive_upcoming} Flash Sale mendatang tidak memiliki produk`);
    }

    if (shopIssues.length > 0) {
      criticalShops.push({
        shop_id: issue.shop_id,
        shop_name: issue.shop_name,
        issues: shopIssues
      });
    }

    return criticalShops;
  }, []);
}

function processDiscountIssues(
  discountData: DiscountIssue,
  existingCriticalShops: CriticalShop[]
): CriticalShop[] {
  const updatedCriticalShops = [...existingCriticalShops];
  const processedShopIds = new Set(existingCriticalShops.map(shop => shop.shop_id));

  // Proses shops_without_backup
  discountData.shops_without_backup.forEach((shop) => {
    if (processedShopIds.has(shop.shop_id)) {
      const existingShop = updatedCriticalShops.find(s => s.shop_id === shop.shop_id);
      if (existingShop) {
        existingShop.issues.push('Tidak ada backup diskon');
      }
    } else {
      updatedCriticalShops.push({
        shop_id: shop.shop_id,
        shop_name: shop.shop_name,
        issues: ['Tidak ada backup diskon']
      });
      processedShopIds.add(shop.shop_id);
    }
  });

  // Proses expired_without_ongoing
  discountData.expired_without_ongoing.forEach((shop) => {
    if (processedShopIds.has(shop.shop_id)) {
      const existingShop = updatedCriticalShops.find(s => s.shop_id === shop.shop_id);
      if (existingShop) {
        existingShop.issues.push('Diskon telah kedaluwarsa tanpa pengganti');
      }
    } else {
      updatedCriticalShops.push({
        shop_id: shop.shop_id,
        shop_name: shop.shop_name,
        issues: ['Diskon telah kedaluwarsa tanpa pengganti']
      });
      processedShopIds.add(shop.shop_id);
    }
  });

  return updatedCriticalShops;
}

async function fetchHealthData(shopIds?: number[]) {
  try {
    console.log('Fetching health data dengan shopIds:', shopIds);
    
    // Menambahkan parameter shopIds ke URL jika tersedia
    let flashSaleUrl = API_ENDPOINTS.flashSale;
    let discountUrl = API_ENDPOINTS.discount;
    
    if (shopIds && shopIds.length > 0) {
      // Menambahkan shopIds sebagai query parameter
      const shopIdsParam = shopIds.join(',');
      flashSaleUrl += `?shopIds=${shopIdsParam}`;
      discountUrl += `?shopIds=${shopIdsParam}`;
      console.log('API URLs dengan shopIds:', { flashSaleUrl, discountUrl });
    }
    
    // Buat variabel default untuk data flash sale dan discount
    let flashSaleData = {
      success: true,
      data: [],
      timestamp: new Date().toISOString()
    };
    
    let discountData = {
      success: true,
      data: {
        shops_without_backup: [],
        ending_soon: [],
        expired_without_ongoing: []
      },
      message: 'Default data'
    };
    
    try {
      // Ambil data flash sale
      const flashSaleResponse = await fetch(flashSaleUrl);
      console.log('Flash sale response status:', flashSaleResponse.status);
      
      if (flashSaleResponse.ok) {
        const fsData = await flashSaleResponse.json();
        console.log('Flash sale data success:', fsData.success);
        
        if (fsData.success) {
          flashSaleData = fsData;
        }
      } else {
        console.error('Flash sale response tidak ok:', flashSaleResponse.status, flashSaleResponse.statusText);
      }
    } catch (fsError) {
      console.error('Error fetching flash sale data:', fsError);
    }
    
    try {
      // Ambil data discount
      const discountResponse = await fetch(discountUrl);
      console.log('Discount response status:', discountResponse.status);
      
      if (discountResponse.ok) {
        const dcData = await discountResponse.json();
        console.log('Discount data success:', dcData.success);
        
        if (dcData.success) {
          discountData = dcData;
        }
      } else {
        console.error('Discount response tidak ok:', discountResponse.status, discountResponse.statusText);
      }
    } catch (dcError) {
      console.error('Error fetching discount data:', dcError);
    }
    
    return { flashSaleData, discountData };
  } catch (error) {
    console.error('Error fetching health data:', error);
    // Kembalikan data default jika terjadi error
    return {
      flashSaleData: {
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      },
      discountData: {
        success: true,
        data: {
          shops_without_backup: [],
          ending_soon: [],
          expired_without_ongoing: []
        },
        message: 'Error fetching data'
      }
    };
  }
}

export async function checkOpenAIKey(apiKey: string): Promise<OpenAICheckResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return {
        success: false,
        message: errorData.error?.message || 'Invalid API key'
      };
    }

    return {
      success: true,
      message: 'API key valid'
    };
  } catch (error) {
    console.error('OpenAI API Check Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengecek API key'
    };
  }
}

// Tambahkan interface Shop
interface Shop {
  shop_id: number;
  shop_name: string;
  is_active: boolean;
  access_token: string;
}

// Main Function
export async function checkShopHealth(shopIds?: number[]): Promise<ShopHealthResponse> {
  try {
    // Ambil data flash sale dan diskon dengan meneruskan shopIds
    const { flashSaleData, discountData } = await fetchHealthData(shopIds);

    // Process Flash Sale issues
    const criticalShops = processFlashSaleIssues(flashSaleData.data);
    
    // Process Discount issues
    const updatedCriticalShops = processDiscountIssues(discountData.data, criticalShops);

    // Ambil data return issues untuk toko yang diberikan
    let returnIssues: ReturnIssue[] = [];
    try {
      if (shopIds && shopIds.length > 0) {
        console.log('Memeriksa return issues untuk toko-toko:', shopIds);
        const returnPromises = shopIds.map(shopId => checkReturnIssues(shopId));
        const returnResults = await Promise.all(returnPromises);
        returnIssues = returnResults.flat();
      } else {
        console.log('Tidak ada shopIds yang diberikan, tidak memeriksa return issues');
      }
    } catch (error) {
      console.error('Error fetching return issues:', error);
    }

    return {
      success: true,
      data: {
        flashSaleIssues: flashSaleData.data,
        discountIssues: discountData.data,
        returnIssues,
        summary: {
          totalIssues: updatedCriticalShops.length + returnIssues.length,
          criticalShops: updatedCriticalShops
        }
      },
      message: 'Berhasil memeriksa kesehatan toko'
    };

  } catch (error) {
    console.error('Error dalam pemeriksaan kesehatan toko:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function checkReturnIssues(shopId: number): Promise<ReturnIssue[]> {
  try {
    
    // Tambahkan parameter status=PROCESSED
    const response = await fetch(
      `http://localhost:10000/api/return?` + 
      `shop_id=${shopId}&` +
      `status=PROCESSING`
    );
    
    if (!response.ok) {
      throw new Error('Gagal mengambil data return');
    }

    const data = await response.json();
    
    // Filter return dengan return_solution = 1 dan status = PROCESSED
    const criticalReturns = data.data.return
      .filter((item: any) => 
        item.return_solution === 1 && 
        item.status === 'PROCESSING'
      )
      .map((item: any) => ({
        // Menyimpan semua properti asli
        ...item,
        // Tambahkan shop_id
        shop_id: shopId
      }));

    return criticalReturns;
  } catch (error) {
    console.error('Error fetching return data:', error);
    throw error;
  }
}
