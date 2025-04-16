import { NextRequest, NextResponse } from 'next/server';

/**
 * API untuk tracking paket ShopeeXpress
 * @param req Request object
 * @returns Response dengan data tracking paket
 */
export async function GET(req: NextRequest) {
  try {
    // Dapatkan tracking number dari query parameters
    const searchParams = req.nextUrl.searchParams;
    const trackingNumber = searchParams.get('tracking_number');

    // Validasi tracking number
    if (!trackingNumber) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Parameter tracking_number diperlukan' 
        },
        { status: 400 }
      );
    }

    // Buat request ke API ShopeeXpress
    const response = await fetch(
      `https://spx.co.id/shipment/order/open/order/get_order_info?spx_tn=${trackingNumber}&language_code=id`,
      {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'Referer': `https://spx.co.id/track?${trackingNumber}`,
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
        },
      }
    );

    // Jika respons tidak OK, lempar error
    if (!response.ok) {
      throw new Error(`ShopeeXpress API error: ${response.status}`);
    }

    // Parse dan kembalikan respons dari API ShopeeXpress
    const data = await response.json();

    // Periksa jika ada kesalahan dari respons API
    if (data.retcode !== 0) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || 'Terjadi kesalahan pada API ShopeeXpress',
          error: data
        },
        { status: 400 }
      );
    }

    // Kembalikan respons sukses dengan data tracking
    return NextResponse.json({
      success: true,
      tracking_number: trackingNumber,
      data: data.data
    });

  } catch (error) {
    console.error('Error tracking ShopeeXpress package:', error);
    
    // Kembalikan respons error
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat melacak paket',
      },
      { status: 500 }
    );
  }
} 