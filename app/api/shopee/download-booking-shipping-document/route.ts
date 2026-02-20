import { NextRequest, NextResponse } from 'next/server';
import { downloadBookingShippingDocument } from '@/app/services/shopeeService';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Autentikasi user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'User tidak terautentikasi'
        },
        { status: 401 }
      );
    }

    // Ambil data dari request body
    const body = await request.json();
    const { shopId, bookingList } = body;

    // Validasi parameter wajib
    if (!shopId) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_SHOP_ID',
          message: 'shopId diperlukan'
        },
        { status: 400 }
      );
    }

    if (!bookingList || !Array.isArray(bookingList) || bookingList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_BOOKING_LIST',
          message: 'bookingList tidak boleh kosong dan harus berupa array'
        },
        { status: 400 }
      );
    }

    // Limit removed. Backend chunking handles array > 50 natively.

    // Validasi setiap booking dalam list
    for (let i = 0; i < bookingList.length; i++) {
      const booking = bookingList[i];
      if (!booking.booking_sn || typeof booking.booking_sn !== 'string' || booking.booking_sn.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_BOOKING_SN',
            message: `booking_sn tidak boleh kosong pada index ${i}`
          },
          { status: 400 }
        );
      }
    }

    console.log(`User ${user.email} mengunduh dokumen pengiriman booking untuk toko ${shopId} dengan ${bookingList.length} booking`);

    // Panggil service untuk mengunduh dokumen secara bergelombang dan dicombine
    const CHUNK_SIZE = 50;
    const mergedPdf = await PDFDocument.create();
    let hasValidPdf = false;
    let lastError = null;

    for (let i = 0; i < bookingList.length; i += CHUNK_SIZE) {
      const chunk = bookingList.slice(i, i + CHUNK_SIZE);
      const result = await downloadBookingShippingDocument(shopId, chunk);

      if (result instanceof Buffer) {
        try {
          const pdfDoc = await PDFDocument.load(result);
          const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          hasValidPdf = true;
        } catch (pdfError) {
          console.error(`Gagal memparsing PDF untuk chunk ${i / CHUNK_SIZE + 1}:`, pdfError);
        }
      } else if (result.error) {
        console.warn(`Gagal mengunduh chunk ${i / CHUNK_SIZE + 1}:`, result.message);
        lastError = result; // Simpan error terakhir apabila semua chunk gagal
      }
    }

    // Jika setidaknya ada 1 halaman PDF yang berhasil digabungkan
    if (hasValidPdf) {
      const mergedPdfBytes = await mergedPdf.save();
      const mergedBuffer = Buffer.from(mergedPdfBytes);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `booking-shipping-document-${shopId}-${timestamp}.pdf`;

      console.log(`Berhasil mengunduh dokumen pengiriman booking untuk toko ${shopId}, ukuran file gabungan: ${mergedBuffer.length} bytes`);

      return new NextResponse(mergedBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': mergedBuffer.length.toString(),
        },
      });
    }

    // Jika hasil adalah error response dan tidak ada 1 file pun yg berhasil diunduh
    if (lastError && !hasValidPdf) {
      const statusCode = lastError.error === 'invalid_parameters' ? 400 : 500;
      return NextResponse.json(
        {
          success: false,
          error: lastError.error,
          message: lastError.message,
          request_id: lastError.request_id
        },
        { status: statusCode }
      );
    }

    // Jika format response tidak dikenali
    return NextResponse.json(
      {
        success: false,
        error: 'UNKNOWN_RESPONSE_FORMAT',
        message: 'Format response dari service tidak dikenali'
      },
      { status: 500 }
    );

  } catch (error) {
    console.error('Error saat mengunduh dokumen pengiriman booking:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan server internal'
      },
      { status: 500 }
    );
  }
} 