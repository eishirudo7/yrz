import axios from 'axios';
import crypto from 'crypto';
import { JSONStringify, JSONParse } from 'json-with-bigint';

export class ShopeeAPI {
  private partnerId: number;
  private partnerKey: string;

  constructor(partnerId: number, partnerKey: string) {
    
    this.partnerId = partnerId;
    this.partnerKey = partnerKey;
  }

  private _generateSign(path: string, accessToken?: string, shopId?: number): [number, string] {
    const timest = Math.floor(Date.now() / 1000);
    let baseString = `${this.partnerId}${path}${timest}`;
    if (accessToken && shopId) {
      baseString += `${accessToken}${shopId}`;
    }
    const sign = crypto.createHmac('sha256', this.partnerKey).update(baseString).digest('hex');
    return [timest, sign];
  }

  generateAuthUrl(redirectUrl: string): string {
    const [timest, sign] = this._generateSign('/api/v2/shop/auth_partner');
    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      redirect: redirectUrl
    });
    return `https://partner.shopeemobile.com/api/v2/shop/auth_partner?${params.toString()}`;
  }

  generateDeauthUrl(redirectUrl: string): string {
    const [timest, sign] = this._generateSign('/api/v2/shop/cancel_auth_partner');
    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      redirect: redirectUrl
    });
    return `https://partner.shopeemobile.com/api/v2/shop/cancel_auth_partner?${params.toString()}`;
  }

  async getTokens(code: string, shopId: number): Promise<any> {
    return this._callTokenApi(code, shopId);
  }

  private async _callTokenApi(code: string, shopId: number): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/auth/token/get';
    const path = '/api/v2/auth/token/get';
    const [timest, sign] = this._generateSign(path);

    const body = {
      code,
      shop_id: shopId,
      partner_id: this.partnerId
    };

    const fullUrl = `${url}?partner_id=${this.partnerId}&timestamp=${timest}&sign=${sign}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.debug('Response from Shopee API:', response.data);

      if (!response.data.access_token || !response.data.refresh_token) {
        throw new Error('Response from Shopee API does not contain access_token or refresh_token');
      }

      return response.data;
    } catch (error) {
      console.error('Error calling Shopee API:', error);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string, shopId: number): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/auth/access_token/get';
    const path = '/api/v2/auth/access_token/get';
    const [timest, sign] = this._generateSign(path);

    const body = {
      refresh_token: refreshToken,
      shop_id: shopId,
      partner_id: this.partnerId
    };

    const fullUrl = `${url}?partner_id=${this.partnerId}&timestamp=${timest}&sign=${sign}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.post(fullUrl, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Shopee API Error:', error);
      throw error;
    }
  }

  async getOrderDetail(shopId: number, orderSn: string, accessToken: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/order/get_order_detail';
    const path = '/api/v2/order/get_order_detail';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      order_sn_list: orderSn,
      response_optional_fields: 'buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,buyer_username,invoice_data,no_plastic_packing,order_chargeable_weight_gram,edt'
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    console.info(`Mengirim permintaan ke Shopee API untuk detail pesanan: URL=${fullUrl}, Headers=${JSON.stringify(headers)}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response content: ${response.data}`);
      return response.data;
    } catch (error) {
      console.error('Error mendapatkan detail pesanan:', error);
      throw error;
    }
  }

  async getTrackingNumber(shopId: number, orderSn: string, accessToken: string, packageNumber?: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/logistics/get_tracking_number';
    const path = '/api/v2/logistics/get_tracking_number';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      order_sn: orderSn,
    });

    if (packageNumber) {
      params.append('package_number', packageNumber);
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    console.info(`Sending request to Shopee API for tracking number: URL=${fullUrl}, Headers=${JSON.stringify(headers)}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status code: ${response.status}, Response content: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Error getting tracking number:', error);
      throw error;
    }
  }

  async getShopInfo(shopId: number, accessToken: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop/get_shop_info';
    const path = '/api/v2/shop/get_shop_info';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      entry_list: 'shop_name'
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting shop info:', error);
      throw error;
    }
  }

  async getShippingParameter(shopId: number, orderSn: string, accessToken: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/logistics/get_shipping_parameter';
    const path = '/api/v2/logistics/get_shipping_parameter';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      order_sn: orderSn
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting shipping parameter:', error);
      throw error;
    }
  }

  async shipOrder(shopId: number, orderSn: string, accessToken: string, pickup?: any, dropoff?: any): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/logistics/ship_order';
    const path = '/api/v2/logistics/ship_order';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body: any = {
      order_sn: orderSn
    };

    if (pickup) {
      body.pickup = pickup;
    } else if (dropoff) {
      body.dropoff = dropoff;
    } else {
      throw new Error('Harus menyediakan informasi pickup atau dropoff');
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    console.info(`Mengirim permintaan ke Shopee API untuk mengirim pesanan: URL=${fullUrl}, Headers=${JSON.stringify(headers)}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
      
      return {
        success: !response.data.error,
        ...response.data
      };
    } catch (error) {
      console.error('Kesalahan saat mengirim pesanan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
        message: (error as any)?.response?.data?.message || '',
        request_id: (error as any)?.response?.data?.request_id || ''
      };
    }
  }

  async getReadyToShipOrders(shopId: number, accessToken: string, pageSize: number = 20, cursor: string = ''): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/order/get_shipment_list';
    const path = '/api/v2/order/get_shipment_list';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      page_size: pageSize.toString(),
      cursor
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting ready to ship orders:', error);
      throw error;
    }
  }

  async getEscrowDetail(shopId: number, orderSn: string, accessToken: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/payment/get_escrow_detail';
    const path = '/api/v2/payment/get_escrow_detail';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      order_sn: orderSn
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting escrow detail:', error);
      throw error;
    }
  }

  async getAdsDailyPerformance(shopId: number, accessToken: string, startDate: string, endDate: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/ads/get_all_cpc_ads_daily_performance';
    const path = '/api/v2/ads/get_all_cpc_ads_daily_performance';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    console.info(`Sending request to Shopee API for ads daily performance: URL=${fullUrl}, Headers=${JSON.stringify(headers)}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status code: ${response.status}, Response content: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Error getting ads daily performance:', error);
      throw error;
    }
  }
  async getConversationList(shopId: number, accessToken: string, options: {
    direction: 'latest' | 'older',
    type: 'all' | 'pinned' | 'unread',
    next_timestamp_nano?: number,
    page_size?: number
  }): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/get_conversation_list';
    const path = '/api/v2/sellerchat/get_conversation_list';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      direction: options.direction,
      type: options.type,
      page_size: (options.page_size || 25).toString()
    });

    if (options.next_timestamp_nano) {
      params.append('next_timestamp_nano', options.next_timestamp_nano.toString());
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting conversation list:', error);
      throw error;
    }
  }

  async getOneConversation(shopId: number, accessToken: string, conversationId: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/get_one_conversation';
    const path = '/api/v2/sellerchat/get_one_conversation';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      conversation_id: conversationId
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting one conversation:', error);
      throw error;
    }
  }

  async getMessages(shopId: number, accessToken: string, conversationId: string, options: {
    offset?: string,
    page_size?: number,
    message_id_list?: number[]
  }): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/get_message';
    const path = '/api/v2/sellerchat/get_message';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      conversation_id: conversationId,
      page_size: (options.page_size || 25).toString()
    });

    if (options.offset) {
      params.append('offset', options.offset);
    }

    if (options.message_id_list && options.message_id_list.length > 0) {
      params.append('message_id_list', JSON.stringify(options.message_id_list));
    }

    const fullUrl = `${url}?${params.toString()}`;
    console.info({fullUrl})
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async sendMessage(shopId: number, accessToken: string, toId: number, messageType: string, content: any): Promise<any> {
    // Validasi input
    if (!Number.isInteger(toId) || toId <= 0) {
      throw new Error('Invalid to_id. Harus berupa bilangan bulat positif.');
    }
    if (!['text', 'sticker', 'image', 'item', 'order'].includes(messageType)) {
      throw new Error('Invalid message_type. Harus berupa "text", "sticker", "image", "item", atau "order".');
    }

    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/send_message';
    const path = '/api/v2/sellerchat/send_message';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body: any = {
      to_id: toId,
      message_type: messageType,
      content: {}
    };

    // Menyesuaikan content berdasarkan message_type
    switch (messageType) {
      case 'text':
        if (typeof content !== 'string' || content.trim().length === 0) {
          throw new Error('Invalid content for text message. Harus berupa string non-kosong.');
        }
        body.content.text = content;
        break;
      case 'sticker':
        if (!content.sticker_id || !content.sticker_package_id) {
          throw new Error('Invalid content for sticker message. Harus menyertakan sticker_id dan sticker_package_id.');
        }
        body.content.sticker_id = content.sticker_id;
        body.content.sticker_package_id = content.sticker_package_id;
        break;
      case 'image':
        if (!content.image_url) {
          throw new Error('Invalid content for image message. Harus menyertakan image_url.');
        }
        body.content.image_url = content.image_url;
        break;
      case 'item':
        if (!Number.isInteger(content.item_id) || content.item_id <= 0) {
          throw new Error('Invalid content for item message. item_id harus berupa bilangan bulat positif.');
        }
        body.content.item_id = content.item_id;
        break;
      case 'order':
        if (typeof content.order_sn !== 'string' || content.order_sn.trim().length === 0) {
          throw new Error('Invalid content for order message. order_sn harus berupa string non-kosong.');
        }
        body.content.order_sn = content.order_sn;
        break;
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.post(fullUrl, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Error mengirim pesan:', error);
      throw error;
    }
  }

  async readConversation(shopId: number, accessToken: string, conversationId: BigInt, lastReadMessageId: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/read_conversation';
    const path = '/api/v2/sellerchat/read_conversation';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    // Gunakan JSONStringify untuk body request
    const body = JSONStringify({
      conversation_id: conversationId,
      last_read_message_id: lastReadMessageId
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.post(fullUrl, body, { headers });
      // Parse response dengan JSONParse
      return JSONParse(JSON.stringify(response.data));
    } catch (error) {
      console.error('Error reading conversation:', error);
      throw error;
    }
  }

  async unreadConversation(shopId: number, accessToken: string, conversationId: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/unread_conversation';
    const path = '/api/v2/sellerchat/unread_conversation';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body = {
      conversation_id: conversationId
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.post(fullUrl, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Error unreading conversation:', error);
      throw error;
    }
  }

  async getUnreadConversationCount(shopId: number, accessToken: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/get_unread_conversation_count';
    const path = '/api/v2/sellerchat/get_unread_conversation_count';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Error getting unread conversation count:', error);
      throw error;
    }
  }

  async uploadImage(shopId: number, accessToken: string, file: File): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/sellerchat/upload_image';
    const path = '/api/v2/sellerchat/upload_image';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const formData = new FormData();
    formData.append('file', file);

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'multipart/form-data' };

    try {
      const response = await axios.post(fullUrl, formData, { headers });
      return response.data;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  async createShippingDocument(
    shopId: number, 
    accessToken: string, 
    orderList: Array<{
      order_sn: string,
      package_number?: string,
      tracking_number?: string
    }>,
    documentType: string = 'THERMAL_AIR_WAYBILL'
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/logistics/create_shipping_document';
    const path = '/api/v2/logistics/create_shipping_document';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body = {
      order_list: orderList,
      shipping_document_type: documentType
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    console.info(`Mengirim permintaan ke Shopee API untuk membuat dokumen pengiriman: URL=${fullUrl}, Headers=${JSON.stringify(headers)}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat membuat dokumen pengiriman:', error);
      throw error;
    }
  }

  async downloadShippingDocument(
    shopId: number,
    accessToken: string,
    orderList: Array<{
      order_sn: string,
      package_number?: string,
      shipping_document_type?: string
    }>
  ): Promise<Buffer | any> {
    const url = 'https://partner.shopeemobile.com/api/v2/logistics/download_shipping_document';
    const path = '/api/v2/logistics/download_shipping_document';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body = {
      order_list: orderList
    };

    const fullUrl = `${url}?${params.toString()}`;
    
    try {
      // Ubah konfigurasi axios untuk menerima response berupa arraybuffer
      const response = await axios.post(fullUrl, body, { 
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer' // Tambahkan ini
      });

      // Pastikan response adalah PDF
      if (response.headers['content-type']?.includes('application/pdf')) {
        return Buffer.from(response.data);
      }

      // Jika bukan PDF, mungkin ada pesan error dari API
      const errorResponse = JSON.parse(response.data.toString());
      console.error('Error response dari Shopee API:', errorResponse);
      
      return {
        error: errorResponse.error || "unknown_error",
        message: errorResponse.message || "Terjadi kesalahan dari API Shopee"
      };

    } catch (error) {
      console.error('Kesalahan saat mengunduh dokumen pengiriman:', error);
      
      // Jika error response berisi data
      if (axios.isAxiosError(error) && error.response?.data) {
        try {
          const errorData = JSON.parse(error.response.data.toString());
          return {
            error: errorData.error || "api_error",
            message: errorData.message || "Terjadi kesalahan dari API Shopee"
          };
        } catch (e) {
          // Jika tidak bisa di-parse sebagai JSON
          return {
            error: "parse_error",
            message: `Terjadi kesalahan saat memproses response: ${error.message}`
          };
        }
      }

      return {
        error: "request_error",
        message: `Terjadi kesalahan saat request: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getOrderList(
    shopId: number, 
    accessToken: string, 
    options: {
      time_range_field: 'create_time' | 'update_time',
      time_from: number,
      time_to: number,
      page_size?: number,
      cursor?: string,
      order_status?: string,
      response_optional_fields?: string[]
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/order/get_order_list';
    const path = '/api/v2/order/get_order_list';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      time_range_field: options.time_range_field,
      time_from: options.time_from.toString(),
      time_to: options.time_to.toString(),
      page_size: (options.page_size || 20).toString(),
    });

    if (options.cursor) {
      params.append('cursor', options.cursor);
    }

    if (options.order_status && options.order_status !== 'ALL') {
      params.append('order_status', options.order_status);
    }

    if (options.response_optional_fields && options.response_optional_fields.length > 0) {
      params.append('response_optional_fields', options.response_optional_fields.join(','));
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan ke Shopee API untuk daftar pesanan: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error('Error mendapatkan daftar pesanan:', error);
      throw error;
    }
  }

  async handleBuyerCancellation(
    shopId: number,
    accessToken: string,
    orderSn: string,
    operation: 'ACCEPT' | 'REJECT'
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/order/handle_buyer_cancellation';
    const path = '/api/v2/order/handle_buyer_cancellation';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body = {
      order_sn: orderSn,
      operation
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    console.info(`Mengirim permintaan untuk menangani pembatalan pembeli: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat menangani pembatalan pembeli:', error);
      throw error;
    }
  }

  async addDiscount(shopId: number, accessToken: string, discountData: {
    discount_name: string,  // Title of the discount
    start_time: number,     // Timestamp when discount starts
    end_time: number       // Timestamp when discount ends
  }): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/add_discount';
    const path = '/api/v2/discount/add_discount';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    // Validasi input
    if (!discountData.discount_name || discountData.discount_name.trim().length === 0) {
      throw new Error('Nama diskon tidak boleh kosong');
    }

    // Validasi waktu
    const currentTime = Math.floor(Date.now() / 1000);
    const oneHourInSeconds = 3600;
    const maxDurationInSeconds = 180 * 24 * 3600; // 180 days in seconds

    if (discountData.start_time <= currentTime + oneHourInSeconds) {
      throw new Error('Waktu mulai harus minimal 1 jam dari waktu sekarang');
    }

    if (discountData.end_time <= discountData.start_time + oneHourInSeconds) {
      throw new Error('Waktu selesai harus minimal 1 jam dari waktu mulai');
    }

    if (discountData.end_time - discountData.start_time > maxDurationInSeconds) {
      throw new Error('Periode diskon tidak boleh lebih dari 180 hari');
    }

    const body = {
      discount_name: discountData.discount_name,
      start_time: discountData.start_time,
      end_time: discountData.end_time
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk menambah diskon: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat menambah diskon:', error);
      throw error;
    }
  }

  async addDiscountItem(
    shopId: number, 
    accessToken: string, 
    discountId: number,
    items: Array<{
        item_id: number,
        purchase_limit: 0,
        model_id?: number,
        promotion_price: number,
        stock: number
    }>
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/add_discount_item';
    const path = '/api/v2/discount/add_discount_item';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    // Validasi input
    if (!discountId || discountId <= 0) {
        throw new Error('discount_id tidak valid');
    }

    if (!items || items.length === 0) {
        throw new Error('Harus menyertakan minimal satu item');
    }

    // Validasi setiap item
    items.forEach((item, index) => {
        if (!item.item_id || item.item_id <= 0) {
            throw new Error(`item_id tidak valid pada item index ${index}`);
        }
        if (item.promotion_price < 0) {
            throw new Error(`promotion_price tidak valid pada item index ${index}`);
        }
        if (item.stock <= 0) {
            throw new Error(`stock harus lebih dari 0 pada item index ${index}`);
        }
    });

    const body = {
        discount_id: discountId,
        item_list: items
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk menambah item diskon: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
        const response = await axios.post(fullUrl, body, { headers });
        console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat menambah item diskon:', error);
        throw error;
    }
  }

  async deleteDiscount(
    shopId: number,
    accessToken: string,
    discountId: number
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/delete_discount';
    const path = '/api/v2/discount/delete_discount';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    // Validasi input
    if (!discountId || discountId <= 0) {
        throw new Error('discount_id tidak valid');
    }

    const body = {
        discount_id: discountId
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk menghapus diskon: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
        const response = await axios.post(fullUrl, body, { headers });
        console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat menghapus diskon:', error);
        throw error;
    }
  }

  // Method untuk menghapus item dari diskon
  async deleteDiscountItem(
    shopId: number,
    accessToken: string,
    discountId: number,
    itemIds: Array<{
        item_id: number,
        model_id?: number
    }>
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/delete_discount_item';
    const path = '/api/v2/discount/delete_discount_item';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    // Validasi input
    if (!discountId || discountId <= 0) {
        throw new Error('discount_id tidak valid');
    }

    if (!itemIds || itemIds.length === 0) {
        throw new Error('Harus menyertakan minimal satu item');
    }

    const body = {
        discount_id: discountId,
        item_list: itemIds
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk menghapus item diskon: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
        const response = await axios.post(fullUrl, body, { headers });
        console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat menghapus item diskon:', error);
        throw error;
    }
  }

  // Method untuk mendapatkan detail diskon
  async getDiscount(
    shopId: number,
    accessToken: string,
    discountId: number
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/get_discount';
    const path = '/api/v2/discount/get_discount';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken,
        discount_id: discountId.toString()
    });

    // Validasi input
    if (!discountId || discountId <= 0) {
        throw new Error('discount_id tidak valid');
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan detail diskon: URL=${fullUrl}`);

    try {
        const response = await axios.get(fullUrl, { headers });
        console.info(`Kode status respons: ${response.status}, Konten respons: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat mendapatkan detail diskon:', error);
        throw error;
    }
  }

  // Method untuk mendapatkan daftar diskon
  async getDiscountList(
    shopId: number,
    accessToken: string,
    options: {
        discount_status: 'upcoming' | 'ongoing' | 'expired' | 'all',
        page_size?: number,
        cursor?: string
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/get_discount_list';
    const path = '/api/v2/discount/get_discount_list';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken,
        discount_status: options.discount_status
    });

    if (options.page_size) {
        params.append('page_size', options.page_size.toString());
    }
    if (options.cursor) {
        params.append('cursor', options.cursor);
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response = await axios.get(fullUrl, { headers });
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat mengambil daftar diskon:', error);
        throw error;
    }
  }

  // Method untuk mengupdate diskon
  async updateDiscount(
    shopId: number,
    accessToken: string,
    discountId: number,
    updateData: {
        discount_name?: string,
        start_time?: number,
        end_time?: number
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/update_discount';
    const path = '/api/v2/discount/update_discount';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const body = {
        discount_id: discountId,
        ...updateData
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response = await axios.post(fullUrl, body, { headers });
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat mengupdate diskon:', error);
        throw error;
    }
  }

  // Method untuk mengupdate item diskon
  async updateDiscountItem(
    shopId: number,
    accessToken: string,
    discountId: number,
    items: Array<{
      item_id: number,
      purchase_limit?: number,
      model_list: Array<{
        model_id: number,
        model_promotion_price: number
      }>
    }>
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/update_discount_item';
    const path = '/api/v2/discount/update_discount_item';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const body = {
        discount_id: discountId,
        item_list: items
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    // Menambahkan logging untuk request
    console.info('Request ke Shopee API:');
    console.info('URL:', fullUrl);
    console.info('Headers:', JSON.stringify(headers, null, 2));
    console.info('Body:', JSON.stringify(body, null, 2));

    try {
        const response = await axios.post(fullUrl, body, { headers });
        // Menambahkan logging untuk response
        console.info('Response dari Shopee API:');
        console.info('Status:', response.status);
        console.info('Data:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat mengupdate item diskon:', error);
        // Menambahkan logging untuk error response jika ada
        if (axios.isAxiosError(error) && error.response) {
            console.error('Error Response:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw error;
    }
  }

  // Method untuk mengakhiri diskon
  async endDiscount(
    shopId: number,
    accessToken: string,
    discountId: number
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/discount/end_discount';
    const path = '/api/v2/discount/end_discount';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const body = {
        discount_id: discountId
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response = await axios.post(fullUrl, body, { headers });
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat mengakhiri diskon:', error);
        throw error;
    }
  }

  async getItemList(
    shopId: number,
    accessToken: string,
    options: {
      offset?: number,
      page_size?: number,
      item_status?: ('NORMAL' | 'BANNED' | 'DELETED' | 'UNLIST')[],
      update_time_from?: number,
      update_time_to?: number,
      item_id_list?: number[],
      need_complaint_policy?: boolean,
      need_tax_info?: boolean
    } = {}
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/get_item_list';
    const path = '/api/v2/product/get_item_list';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      offset: (options.offset || 0).toString(),
      page_size: (options.page_size || 20).toString()
    });

    if (options.item_status?.length) {
      options.item_status.forEach(status => {
        params.append('item_status', status);
      });
    }
    
    if (options.update_time_from) {
      params.append('update_time_from', options.update_time_from.toString());
    }
    
    if (options.update_time_to) {
      params.append('update_time_to', options.update_time_to.toString());
    }

    if (options.item_id_list?.length) {
      params.append('item_id_list', options.item_id_list.join(','));
    }
    if (options.need_complaint_policy !== undefined) {
      params.append('need_complaint_policy', options.need_complaint_policy.toString());
    }
    if (options.need_tax_info !== undefined) {
      params.append('need_tax_info', options.need_tax_info.toString());
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil daftar produk:', error);
      throw error;
    }
  }

  async getItemBaseInfo(
    shopId: number,
    accessToken: string,
    itemIdList: number[]
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/get_item_base_info';
    const path = '/api/v2/product/get_item_base_info';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      item_id_list: itemIdList.join(',')
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil informasi dasar produk:', error);
      throw error;
    }
  }

  async updateItem(
    shopId: number,
    accessToken: string,
    itemId: number,
    updateData: {
      name?: string,
      description?: string,
      item_status?: 'NORMAL' | 'UNLIST',
      category_id?: number,
      brand?: {
        brand_id?: number,
        original_brand_name?: string
      }
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/update_item';
    const path = '/api/v2/product/update_item';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body = {
      item_id: itemId,
      ...updateData
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.post(fullUrl, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengupdate produk:', error);
      throw error;
    }
  }

  async addItem(
    shopId: number,
    accessToken: string,
    itemData: {
      original_price: number,
      description: string,
      weight: number,
      item_name: string,
      category_id: number,
      brand?: {
        brand_id?: number,
        original_brand_name?: string
      },
      dimension?: {
        package_length: number,
        package_width: number,
        package_height: number
      },
      logistic_info?: Array<{
        enabled?: boolean,
        shipping_fee?: number,
        size_id?: number,
        logistic_id: number
      }>,
      condition?: string,
      item_status?: "NORMAL" | "UNLIST",
      item_sku?: string,
      image?: {
        image_id_list?: string[]
      }
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/add_item';
    const path = '/api/v2/product/add_item';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.post(fullUrl, itemData, { headers });
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat menambah produk:', error);
      throw error;
    }
  }

  async deleteItem(
    shopId: number,
    accessToken: string,
    itemId: number
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/delete_item';
    const path = '/api/v2/product/delete_item';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      item_id: itemId.toString()
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await axios.post(fullUrl, {}, { headers });
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat menghapus produk:', error);
      throw error;
    }
  }

  async getModelList(
    shopId: number,
    accessToken: string,
    itemId: number
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/get_model_list';
    const path = '/api/v2/product/get_model_list';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      item_id: itemId.toString()
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan daftar model: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil daftar model:', error);
      throw error;
    }
  }

  async getItemLimit(shopId: number, accessToken: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/get_item_limit';
    const path = '/api/v2/product/get_item_limit';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan limit produk: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil limit produk:', error);
      throw error;
    }
  }

  async updateStock(
    shopId: number,
    accessToken: string,
    itemId: number,
    stockInfo: {
      stock_list: Array<{
        model_id?: number,
        seller_stock: {
          location_id?: string,
          stock: number
        }[]
      }>
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/update_stock';
    const path = '/api/v2/product/update_stock';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    // Validasi input
    if (!stockInfo.stock_list || stockInfo.stock_list.length === 0 || stockInfo.stock_list.length > 50) {
      throw new Error('stock_list harus berisi antara 1 sampai 50 item');
    }

    const body = {
      item_id: itemId,
      ...stockInfo
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mengupdate stok: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengupdate stok:', error);
      throw error;
    }
  }

  async getFlashSaleTimeSlotId(
    shopId: number,
    accessToken: string,
    options: {
      start_time: number,
      end_time: number
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_time_slot_id';
    const path = '/api/v2/shop_flash_sale/get_time_slot_id';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      start_time: options.start_time.toString(),
      end_time: options.end_time.toString()
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan time slot ID flash sale: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil time slot ID flash sale:', error);
      throw error;
    }
  }

  async createShopFlashSale(
    shopId: number,
    accessToken: string,
    timeslotId: number  // Hanya membutuhkan timeslot_id sebagai parameter
): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/create_shop_flash_sale';
    const path = '/api/v2/shop_flash_sale/create_shop_flash_sale';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const body = {
        timeslot_id: timeslotId  // Sesuai dokumentasi, hanya memerlukan timeslot_id
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk membuat flash sale: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
        const response = await axios.post(fullUrl, body, { headers });
        console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat membuat flash sale:', error);
        throw error;
    }
}

  async getFlashSaleItemCriteria(
    shopId: number,
    accessToken: string,
    itemIdList: number[]
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_item_criteria';
    const path = '/api/v2/shop_flash_sale/get_item_criteria';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      item_id_list: itemIdList.join(',')
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan kriteria item flash sale: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil kriteria item flash sale:', error);
      throw error;
    }
  }

  async addShopFlashSaleItems(
    shopId: number,
    accessToken: string,
    data: {
      flash_sale_id: number,
      items: Array<{
        item_id: number,
        purchase_limit: number,
        models: Array<{
          model_id: number,
          input_promo_price: number,
          stock: number
        }>
      }>
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/add_shop_flash_sale_items';
    const path = '/api/v2/shop_flash_sale/add_shop_flash_sale_items';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body = {
      flash_sale_id: data.flash_sale_id,
      items: data.items
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk menambah item flash sale: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat menambah item flash sale:', error);
      throw error;
    }
  }

  async getShopFlashSaleList(
    shopId: number,
    accessToken: string,
    options: {
      type: number,  // 0: all, 1: upcoming, 2: ongoing, 3: expired
      start_time?: number,
      end_time?: number,
      pagination_offset: number,  // min=0, max=1000
      pagination_entry_count: number  // min=1, max=100
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_shop_flash_sale_list';
    const path = '/api/v2/shop_flash_sale/get_shop_flash_sale_list';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      type: options.type.toString(),
      offset: options.pagination_offset.toString(),
      limit: options.pagination_entry_count.toString()
    });

    if (options.start_time && options.end_time) {
      params.append('start_time', options.start_time.toString());
      params.append('end_time', options.end_time.toString());
    }

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan daftar flash sale: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil daftar flash sale:', error);
      throw error;
    }
  }

  async getShopFlashSale(
    shopId: number,
    accessToken: string,
    flashSaleId: number
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_shop_flash_sale';
    const path = '/api/v2/shop_flash_sale/get_shop_flash_sale';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      flash_sale_id: flashSaleId.toString()
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan detail flash sale toko: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil detail flash sale toko:', error);
      throw error;
    }
  }

  async getShopFlashSaleItems(
    shopId: number,
    accessToken: string,
    options: {
      flash_sale_id: number,
      offset: number,  // min=0, max=1000
      limit: number    // min=1, max=100
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_shop_flash_sale_items';
    const path = '/api/v2/shop_flash_sale/get_shop_flash_sale_items';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    // Validasi input
    if (options.offset < 0 || options.offset > 1000) {
      throw new Error('offset harus antara 0 dan 1000');
    }
    if (options.limit < 1 || options.limit > 100) {
      throw new Error('limit harus antara 1 dan 100');
    }

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken,
      flash_sale_id: options.flash_sale_id.toString(),
      offset: options.offset.toString(),
      limit: options.limit.toString()
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan daftar item flash sale: URL=${fullUrl}`);

    try {
      const response = await axios.get(fullUrl, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengambil daftar item flash sale:', error);
      throw error;
    }
  }

  async updateShopFlashSale(
    shopId: number,
    accessToken: string,
    data: {
      flash_sale_id: number,
      status: 1 | 2  // 1: enable, 2: disabled
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/update_shop_flash_sale';
    const path = '/api/v2/shop_flash_sale/update_shop_flash_sale';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    // Validasi status
    if (![1, 2].includes(data.status)) {
      throw new Error('Status harus 1 (enable) atau 2 (disabled)');
    }

    const body = {
      flash_sale_id: data.flash_sale_id,
      status: data.status
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mengupdate status flash sale: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengupdate status flash sale:', error);
      throw error;
    }
  }

  async updateShopFlashSaleItems(
    shopId: number,
    accessToken: string,
    data: {
      flash_sale_id: number,
      items: Array<{
        item_id: number,
        purchase_limit?: number, // optional, min=0, 0 means no limit
        models: Array<{
          model_id: number,
          status: 0 | 1, // 0: disable, 1: enable
          input_promo_price?: number, // optional, hanya bisa diset jika status=1 dan model sebelumnya disabled
          stock?: number // optional, min=1, hanya bisa diset jika status=1 dan model sebelumnya disabled
        }>
      }>
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/update_shop_flash_sale_items';
    const path = '/api/v2/shop_flash_sale/update_shop_flash_sale_items';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    // Validasi input
    for (const item of data.items) {
      if (item.purchase_limit !== undefined && item.purchase_limit < 0) {
        throw new Error('purchase_limit tidak boleh kurang dari 0');
      }
      
      for (const model of item.models) {
        if (![0, 1].includes(model.status)) {
          throw new Error('status model harus 0 (disable) atau 1 (enable)');
        }
        if (model.stock !== undefined && model.stock < 1) {
          throw new Error('stock harus minimal 1');
        }
      }
    }

    const body = {
      flash_sale_id: data.flash_sale_id,
      items: data.items
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mengupdate item flash sale: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat mengupdate item flash sale:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Error Response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }

  async deleteShopFlashSale(
    shopId: number,
    accessToken: string,
    flashSaleId: number
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/delete_shop_flash_sale';
    const path = '/api/v2/shop_flash_sale/delete_shop_flash_sale';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    const body = {
      flash_sale_id: flashSaleId
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk menghapus flash sale: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat menghapus flash sale:', error);
      throw error;
    }
  }

  async deleteShopFlashSaleItems(
    shopId: number,
    accessToken: string,
    data: {
      flash_sale_id: number,
      item_ids: number[]
    }
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/shop_flash_sale/delete_shop_flash_sale_items';
    const path = '/api/v2/shop_flash_sale/delete_shop_flash_sale_items';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: this.partnerId.toString(),
      timestamp: timest.toString(),
      sign,
      shop_id: shopId.toString(),
      access_token: accessToken
    });

    // Validasi input
    if (!data.item_ids || data.item_ids.length === 0) {
      throw new Error('item_ids tidak boleh kosong');
    }

    const body = {
      flash_sale_id: data.flash_sale_id,
      item_ids: data.item_ids
    };

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk menghapus item flash sale: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

    try {
      const response = await axios.post(fullUrl, body, { headers });
      console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Kesalahan saat menghapus item flash sale:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Error Response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }

  async getItemPromotion(
    shopId: number,
    accessToken: string,
    itemIdList: number[]
  ): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/product/get_item_promotion';
    const path = '/api/v2/product/get_item_promotion';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken,
        item_id_list: itemIdList.join(',')
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan informasi promosi produk: URL=${fullUrl}`);

    try {
        const response = await axios.get(fullUrl, { headers });
        console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat mengambil informasi promosi produk:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error('Error Response:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw error;
    }
  }

  async getShopPerformance(shopId: number, accessToken: string): Promise<any> {
    const url = 'https://partner.shopeemobile.com/api/v2/account_health/get_shop_performance';
    const path = '/api/v2/account_health/get_shop_performance';
    const [timest, sign] = this._generateSign(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: this.partnerId.toString(),
        timestamp: timest.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const fullUrl = `${url}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    console.info(`Mengirim permintaan untuk mendapatkan performa toko: URL=${fullUrl}`);

    try {
        const response = await axios.get(fullUrl, { headers });
        console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        console.error('Kesalahan saat mengambil performa toko:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error('Error Response:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw error;
    }
}

async getShopPenalty(shopId: number, accessToken: string): Promise<any> {
  const url = 'https://partner.shopeemobile.com/api/v2/account_health/shop_penalty';
  const path = '/api/v2/account_health/shop_penalty';
  const [timest, sign] = this._generateSign(path, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: this.partnerId.toString(),
    timestamp: timest.toString(),
    sign,
    shop_id: shopId.toString(),
    access_token: accessToken
  });

  const fullUrl = `${url}?${params.toString()}`;
  const headers = { 'Content-Type': 'application/json' };

  console.info(`Mengirim permintaan untuk mendapatkan informasi penalti toko: URL=${fullUrl}`);

  try {
    const response = await axios.get(fullUrl, { headers });
    console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error('Kesalahan saat mengambil informasi penalti toko:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error Response:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}

async cancelOrder(
  shopId: number,
  accessToken: string,
  orderSn: string,
  itemList: Array<{
    item_id: number,
    model_id: number
  }>
): Promise<any> {
  const url = 'https://partner.shopeemobile.com/api/v2/order/cancel_order';
  const path = '/api/v2/order/cancel_order';
  const [timest, sign] = this._generateSign(path, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: this.partnerId.toString(),
    timestamp: timest.toString(),
    sign,
    shop_id: shopId.toString(),
    access_token: accessToken
  });

  // Validasi input
  if (!itemList || itemList.length === 0) {
    throw new Error('item_list tidak boleh kosong');
  }

  const body = {
    order_sn: orderSn,
    cancel_reason: 'OUT_OF_STOCK',
    item_list: itemList
  };

  const fullUrl = `${url}?${params.toString()}`;
  const headers = { 'Content-Type': 'application/json' };

  console.info(`Mengirim permintaan untuk membatalkan pesanan: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

  try {
    const response = await axios.post(fullUrl, body, { headers });
    console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error('Kesalahan saat membatalkan pesanan:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error Response:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}

async setAppPushConfig(options: {
  callback_url?: string;
  set_push_config_on?: number[];
  set_push_config_off?: number[];
  blocked_shop_id_list?: number[];
}): Promise<any> {
  const url = 'https://partner.shopeemobile.com/api/v2/push/set_app_push_config';
  const path = '/api/v2/push/set_app_push_config';
  const [timest, sign] = this._generateSign(path);

  const params = new URLSearchParams({
    partner_id: this.partnerId.toString(),
    timestamp: timest.toString(),
    sign
  });

  const body = {
    ...options
  };

  const fullUrl = `${url}?${params.toString()}`;
  const headers = { 'Content-Type': 'application/json' };

  console.info(`Mengirim permintaan untuk mengatur push config: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

  try {
    const response = await axios.post(fullUrl, body, { headers });
    return response.data;
  } catch (error) {
    console.error('Kesalahan saat mengatur push config:', error);
    throw error;
  }
}

async getAppPushConfig(): Promise<any> {
  const url = 'https://partner.shopeemobile.com/api/v2/push/get_app_push_config';
  const path = '/api/v2/push/get_app_push_config';
  const [timest, sign] = this._generateSign(path);

  const params = new URLSearchParams({
    partner_id: this.partnerId.toString(),
    timestamp: timest.toString(),
    sign
  });

  const fullUrl = `${url}?${params.toString()}`;
  const headers = { 'Content-Type': 'application/json' };

  console.info(`Mengirim permintaan untuk mendapatkan konfigurasi push: URL=${fullUrl}`);

  try {
    const response = await axios.get(fullUrl, { headers });
    console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error('Kesalahan saat mengambil konfigurasi push:', error);
    throw error;
  }
}

async getReturnList(
  shopId: number,
  accessToken: string,
  options: {
    page_no: number,
    page_size: number,
    create_time_from?: number,
    create_time_to?: number, 
    update_time_from?: number,
    update_time_to?: number,
    status?: 'REQUESTED' | 'ACCEPTED' | 'CANCELLED' | 'JUDGING' | 'CLOSED' | 'PROCESSING' | 'SELLER_DISPUTE',
    return_solution?: 'RETURN_REFUND' | 'REFUND',
    return_reason?: 'NONRECEIPT' | 'WRONG_ITEM' | 'ITEM_DAMAGED' | 'DIFF_DESC' | 'MUITAL_AGREE' | 
      'OTHER' | 'USED' | 'NO_REASON' | 'ITEM_WRONGDAMAGED' | 'CHANGE_MIND' | 'ITEM_MISSING' | 
      'EXPECTATION_FAILED' | 'ITEM_FAKE' | 'PHYSICAL_DMG' | 'FUNCTIONAL_DMG' | 'ITEM_NOT_FIT' | 
      'SUSPICIOUS_PARCEL' | 'EXPIRED_PRODUCT' | 'WRONG_ORDER_INFO' | 'WRONG_ADDRESS' | 
      'CHANGE_OF_MIND' | 'SELLER_SENT_WRONG_ITEM' | 'SPILLED_CONTENTS' | 'BROKEN_PRODUCTS' | 
      'DAMAGED_PACKAGE' | 'SCRATCHED' | 'DAMAGED_OTHERS',
    negotiation_status?: 'PENDING_RESPOND' | 'ACCEPTED' | 'REJECTED' | 'PENDING_BUYER_RESPOND' | 'TERMINATED',
    seller_proof_status?: 'PENDING' | 'ACCEPTED' | 'REJECTED',
    seller_compensation_status?: 'NOT_REQUIRED' | 'PENDING_REQUEST' | 'ACCEPTED' | 'REJECTED'
  }
): Promise<any> {
  const url = 'https://partner.shopeemobile.com/api/v2/returns/get_return_list';
  const path = '/api/v2/returns/get_return_list';
  const [timest, sign] = this._generateSign(path, accessToken, shopId);

  // Validasi input
  if (options.page_size > 100) {
    throw new Error('page_size tidak boleh lebih dari 100');
  }

  if (options.create_time_from && options.create_time_to) {
    const diffDays = (options.create_time_to - options.create_time_from) / (24 * 60 * 60);
    if (diffDays > 15) {
      throw new Error('Rentang waktu create_time tidak boleh lebih dari 15 hari');
    }
  }

  if (options.update_time_from && options.update_time_to) {
    const diffDays = (options.update_time_to - options.update_time_from) / (24 * 60 * 60);
    if (diffDays > 15) {
      throw new Error('Rentang waktu update_time tidak boleh lebih dari 15 hari');
    }
  }

  const params = new URLSearchParams({
    partner_id: this.partnerId.toString(),
    timestamp: timest.toString(),
    sign,
    shop_id: shopId.toString(),
    access_token: accessToken,
    page_no: options.page_no.toString(),
    page_size: options.page_size.toString()
  });

  // Tambahkan parameter opsional
  if (options.create_time_from) {
    params.append('create_time_from', options.create_time_from.toString());
  }
  if (options.create_time_to) {
    params.append('create_time_to', options.create_time_to.toString());
  }
  if (options.update_time_from) {
    params.append('update_time_from', options.update_time_from.toString());
  }
  if (options.update_time_to) {
    params.append('update_time_to', options.update_time_to.toString());
  }
  if (options.status) {
    params.append('status', options.status);
  }
  if (options.negotiation_status) {
    params.append('negotiation_status', options.negotiation_status);
  }
  if (options.seller_proof_status) {
    params.append('seller_proof_status', options.seller_proof_status);
  }
  if (options.seller_compensation_status) {
    params.append('seller_compensation_status', options.seller_compensation_status);
  }
  if (options.return_solution) {
    params.append('return_solution', options.return_solution);
  }
  if (options.return_reason) {
    params.append('return_reason', options.return_reason);
  }

  const fullUrl = `${url}?${params.toString()}`;
  const headers = { 'Content-Type': 'application/json' };

  console.info(`Mengirim permintaan untuk mendapatkan daftar retur: URL=${fullUrl}`);

  try {
    const response = await axios.get(fullUrl, { headers });
    console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error('Kesalahan saat mengambil daftar retur:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error Response:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}

async unlistItem(
  shopId: number,
  accessToken: string,
  items: Array<{
    item_id: number,
    unlist: boolean
  }>
): Promise<any> {
  const url = 'https://partner.shopeemobile.com/api/v2/product/unlist_item';
  const path = '/api/v2/product/unlist_item';
  const [timest, sign] = this._generateSign(path, accessToken, shopId);

  // Validasi input
  if (!items || items.length === 0 || items.length > 50) {
    throw new Error('item_list harus berisi antara 1 sampai 50 item');
  }

  const params = new URLSearchParams({
    partner_id: this.partnerId.toString(),
    timestamp: timest.toString(),
    sign,
    shop_id: shopId.toString(),
    access_token: accessToken
  });

  const body = {
    item_list: items
  };

  const fullUrl = `${url}?${params.toString()}`;
  const headers = { 'Content-Type': 'application/json' };

  console.info(`Mengirim permintaan untuk unlist item: URL=${fullUrl}, Body=${JSON.stringify(body)}`);

  try {
    const response = await axios.post(fullUrl, body, { headers });
    console.info(`Response status: ${response.status}, Konten response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error('Kesalahan saat unlist item:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error Response:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}
}

export default ShopeeAPI;
