/**
 * Shopee Service - Booking Operations
 * Migrated to use @congminh1254/shopee-sdk
 */

import { getShopeeSDK } from '@/lib/shopee-sdk';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { createClient } from '@/utils/supabase/server';
import { BookingListOptions, retryOperation } from './utils';

export async function getBookingList(shopId: number, options: BookingListOptions = {}) {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const params: any = {
            time_range_field: options.timeRangeField || 'create_time',
            time_from: options.startTime || Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60),
            time_to: options.endTime || Math.floor(Date.now() / 1000),
            page_size: options.pageSize || 50,
            cursor: options.cursor || '',
        };

        // Hanya kirim booking_status jika bukan 'ALL' (omit = ambil semua status)
        if (options.bookingStatus && options.bookingStatus !== 'ALL') {
            params.booking_status = options.bookingStatus;
        }

        const response: any = await sdk.order.getBookingList(params);

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil daftar booking',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error: unknown) {
        console.error('Gagal mengambil daftar booking:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function getBookingDetail(
    shopId: number,
    bookingSn: string | string[],
    responseOptionalFields?: string[]
): Promise<any> {
    try {
        if (!shopId) {
            return { success: false, error: "invalid_input", message: 'ID Toko diperlukan' };
        }

        let bookingSns: string[];
        if (typeof bookingSn === 'string') {
            if (!bookingSn.trim()) {
                return { success: false, error: "invalid_input", message: 'Nomor booking diperlukan' };
            }
            bookingSns = [bookingSn.trim()];
        } else {
            if (!bookingSn || bookingSn.length === 0 || bookingSn.some(sn => !sn.trim())) {
                return { success: false, error: "invalid_input", message: 'Nomor booking diperlukan dan tidak boleh kosong' };
            }
            bookingSns = bookingSn.map(sn => sn.trim());
        }

        const defaultOptionalFields = [
            'buyer_user_id', 'buyer_username', 'estimated_shipping_fee', 'recipient_address',
            'actual_shipping_fee', 'goods_to_declare', 'note', 'note_update_time', 'item_list',
            'pay_time', 'dropshipper', 'dropshipper_phone', 'split_up', 'buyer_cancel_reason',
            'cancel_by', 'cancel_reason', 'actual_shipping_fee_confirmed', 'buyer_cpf_id',
            'fulfillment_flag', 'pickup_done_time', 'package_list', 'shipping_carrier',
            'payment_method', 'total_amount', 'invoice_data', 'no_plastic_packing',
            'order_chargeable_weight_gram', 'edt', 'prescription_check_status', 'prescription_images'
        ];

        const fieldsToUse = responseOptionalFields || defaultOptionalFields;

        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.order.getBookingDetail({
            booking_sn_list: bookingSns,
            response_optional_fields: fieldsToUse.join(','),
        } as any);

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil detail booking',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error: unknown) {
        console.error('Gagal mengambil detail booking:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function getBookingShippingParameter(shopId: number, bookingSn: string): Promise<any> {
    try {
        if (!shopId) {
            return { success: false, error: "invalid_input", message: 'ID Toko diperlukan' };
        }
        if (!bookingSn || bookingSn.trim().length === 0) {
            return { success: false, error: "invalid_input", message: 'Nomor booking diperlukan' };
        }

        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.logistics.getBookingShippingParameter({
            booking_sn: bookingSn.trim(),
        });

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil parameter pengiriman booking',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error: unknown) {
        console.error('Gagal mengambil parameter pengiriman booking:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function shipBooking(
    shopId: number,
    bookingSn: string,
    shippingMethod: 'pickup' | 'dropoff' = 'dropoff',
    shippingData?: any
): Promise<any> {
    try {
        if (!shopId) {
            return { success: false, error: "invalid_input", message: 'ID Toko diperlukan' };
        }
        if (!bookingSn || bookingSn.trim().length === 0) {
            return { success: false, error: "invalid_input", message: 'Nomor booking diperlukan' };
        }
        if (!['pickup', 'dropoff'].includes(shippingMethod)) {
            return { success: false, error: "invalid_input", message: 'Metode pengiriman harus pickup atau dropoff' };
        }

        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);

        let pickupData = null;
        let dropoffData = null;

        if (shippingData) {
            if (shippingMethod === 'pickup') {
                pickupData = shippingData;
            } else {
                dropoffData = shippingData;
            }
        } else {
            const shippingParams: any = await sdk.logistics.getBookingShippingParameter({
                booking_sn: bookingSn.trim(),
            });

            if (shippingParams.error) {
                return {
                    success: false,
                    error: shippingParams.error,
                    message: shippingParams.message || 'Gagal mendapatkan parameter pengiriman',
                    request_id: shippingParams.request_id || ''
                };
            }

            if (shippingMethod === 'pickup') {
                if (shippingParams.response?.pickup) {
                    pickupData = shippingParams.response.pickup;
                } else {
                    return { success: false, error: "pickup_not_available", message: `Metode pickup tidak tersedia untuk booking ${bookingSn}` };
                }
            } else {
                if (shippingParams.response?.dropoff) {
                    dropoffData = shippingParams.response.dropoff;
                } else {
                    return { success: false, error: "dropoff_not_available", message: `Metode dropoff tidak tersedia untuk booking ${bookingSn}` };
                }
            }
        }

        const shipParams: any = {
            booking_sn: bookingSn.trim(),
        };
        if (shippingMethod === 'pickup' && pickupData) {
            shipParams.pickup = pickupData;
        } else if (dropoffData) {
            shipParams.dropoff = dropoffData;
        }

        const response: any = await sdk.logistics.shipBooking(shipParams);

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal melakukan ship booking',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error: unknown) {
        console.error('Gagal melakukan ship booking:', error);
        return {
            success: false,
            error: "internal_server_error",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
            request_id: ''
        };
    }
}

export async function getBookingTrackingNumber(
    shopId: number,
    bookingSn: string,
    packageNumber?: string
): Promise<any> {
    try {
        if (!shopId) {
            return { success: false, error: "invalid_input", message: 'ID Toko diperlukan' };
        }
        if (!bookingSn || bookingSn.trim().length === 0) {
            return { success: false, error: "invalid_input", message: 'Nomor booking diperlukan' };
        }

        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.logistics.getBookingTrackingNumber({
            booking_sn: bookingSn.trim(),
            ...(packageNumber ? { package_number: packageNumber } : {}),
        } as any);

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil tracking number booking',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error: unknown) {
        console.error('Gagal mengambil tracking number booking:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function createBookingShippingDocument(
    shopId: number,
    bookingList: Array<{
        booking_sn: string,
        package_number?: string,
        tracking_number?: string
    }>,
    documentType: string = 'THERMAL_AIR_WAYBILL'
): Promise<any> {
    try {
        if (!shopId) {
            return { success: false, error: "invalid_input", message: 'ID Toko diperlukan' };
        }
        if (!bookingList || bookingList.length === 0) {
            return { success: false, error: "invalid_input", message: 'Daftar booking tidak boleh kosong' };
        }
        if (bookingList.length > 50) {
            return { success: false, error: "invalid_input", message: 'Jumlah booking tidak boleh lebih dari 50' };
        }

        const validDocumentTypes = ['THERMAL_AIR_WAYBILL', 'NORMAL_AIR_WAYBILL', 'A4_PDF'];
        if (!validDocumentTypes.includes(documentType)) {
            return { success: false, error: "invalid_input", message: `Document type tidak valid. Harus salah satu dari: ${validDocumentTypes.join(', ')}` };
        }

        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.logistics.createBookingShippingDocument({
            booking_list: bookingList,
            document_type: documentType,
        } as any);

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal membuat dokumen pengiriman booking',
                request_id: response.request_id
            };
        }

        // Update database
        try {
            const supabaseClient = await createClient();
            const bookingSns = bookingList.map(b => b.booking_sn);

            await supabaseClient
                .from('booking_orders')
                .update({ document_status: 'READY', updated_at: new Date().toISOString() })
                .eq('shop_id', shopId)
                .in('booking_sn', bookingSns);
        } catch (dbError) {
            console.error('Database update error:', dbError);
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error: unknown) {
        console.error('Gagal membuat dokumen pengiriman booking:', error);
        return {
            success: false,
            error: "internal_server_error",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function downloadBookingShippingDocument(
    shopId: number,
    bookingList: Array<{
        booking_sn: string,
        package_number?: string,
        shipping_document_type?: string
    }>
): Promise<Buffer | any> {
    return retryOperation(async () => {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);

        if (!shopId || !bookingList || bookingList.length === 0) {
            return { error: "invalid_parameters", message: "Parameter shopId dan bookingList harus diisi" };
        }
        if (bookingList.length > 50) {
            return { error: "invalid_parameters", message: "bookingList tidak boleh lebih dari 50 item" };
        }

        const formattedBookingList = bookingList.map(booking => {
            const formattedBooking: { booking_sn: string, package_number?: string, shipping_document_type?: string } = {
                booking_sn: booking.booking_sn.trim()
            };
            if (booking.package_number?.trim()) formattedBooking.package_number = booking.package_number.trim();
            if (booking.shipping_document_type?.trim()) formattedBooking.shipping_document_type = booking.shipping_document_type.trim();
            return formattedBooking;
        });

        const response: any = await sdk.logistics.downloadBookingShippingDocument({
            booking_list: formattedBookingList,
        } as any);

        if (response instanceof Buffer) return response;
        if (response.error) return { error: response.error, message: response.message || "Gagal mengunduh dokumen booking" };
        return { error: "invalid_response", message: "Response tidak valid dari Shopee API" };
    });
}
