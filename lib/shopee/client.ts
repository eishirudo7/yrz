/**
 * Shopee API Base Client
 * Handles authentication signature generation and base API request utilities
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';

const SHOPEE_API_BASE_URL = 'https://partner.shopeemobile.com';

export interface ShopeeClientConfig {
    partnerId: number;
    partnerKey: string;
}

/**
 * Generate HMAC-SHA256 signature for Shopee API requests
 */
export function generateSign(
    partnerKey: string,
    partnerId: number,
    path: string,
    timestamp: number,
    accessToken?: string,
    shopId?: number
): string {
    let baseString = `${partnerId}${path}${timestamp}`;
    if (accessToken && shopId) {
        baseString += `${accessToken}${shopId}`;
    }
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

/**
 * Generate timestamp and signature for API request
 */
export function generateSignature(
    config: ShopeeClientConfig,
    path: string,
    accessToken?: string,
    shopId?: number
): { timestamp: number; sign: string } {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(config.partnerKey, config.partnerId, path, timestamp, accessToken, shopId);
    return { timestamp, sign };
}

/**
 * Build common query parameters for Shopee API
 */
export function buildBaseParams(
    config: ShopeeClientConfig,
    timestamp: number,
    sign: string,
    shopId?: number,
    accessToken?: string
): URLSearchParams {
    const params = new URLSearchParams({
        partner_id: config.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
    });

    if (shopId) {
        params.append('shop_id', shopId.toString());
    }
    if (accessToken) {
        params.append('access_token', accessToken);
    }

    return params;
}

/**
 * Make a GET request to Shopee API
 */
export async function shopeeGet<T = any>(
    config: ShopeeClientConfig,
    path: string,
    params: URLSearchParams,
    accessToken?: string,
    shopId?: number
): Promise<T> {
    const { timestamp, sign } = generateSignature(config, path, accessToken, shopId);
    const baseParams = buildBaseParams(config, timestamp, sign, shopId, accessToken);

    // Merge additional params
    params.forEach((value, key) => {
        if (!baseParams.has(key)) {
            baseParams.append(key, value);
        }
    });

    const url = `${SHOPEE_API_BASE_URL}${path}?${baseParams.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response: AxiosResponse<T> = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        console.error(`Shopee API GET Error [${path}]:`, error);
        throw error;
    }
}

/**
 * Make a POST request to Shopee API
 */
export async function shopeePost<T = any>(
    config: ShopeeClientConfig,
    path: string,
    body: any,
    accessToken?: string,
    shopId?: number,
    axiosConfig?: Partial<AxiosRequestConfig>
): Promise<T> {
    const { timestamp, sign } = generateSignature(config, path, accessToken, shopId);
    const params = buildBaseParams(config, timestamp, sign, shopId, accessToken);

    const url = `${SHOPEE_API_BASE_URL}${path}?${params.toString()}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response: AxiosResponse<T> = await axios.post(url, body, {
            headers,
            ...axiosConfig
        });
        return response.data;
    } catch (error) {
        console.error(`Shopee API POST Error [${path}]:`, error);
        throw error;
    }
}

/**
 * ShopeeClient class - provides a configured client instance
 */
export class ShopeeClient {
    private config: ShopeeClientConfig;

    constructor(partnerId: number, partnerKey: string) {
        this.config = { partnerId, partnerKey };
    }

    get partnerId(): number {
        return this.config.partnerId;
    }

    get partnerKey(): string {
        return this.config.partnerKey;
    }

    getConfig(): ShopeeClientConfig {
        return this.config;
    }

    generateSignature(path: string, accessToken?: string, shopId?: number) {
        return generateSignature(this.config, path, accessToken, shopId);
    }

    async get<T = any>(
        path: string,
        params: URLSearchParams = new URLSearchParams(),
        accessToken?: string,
        shopId?: number
    ): Promise<T> {
        return shopeeGet<T>(this.config, path, params, accessToken, shopId);
    }

    async post<T = any>(
        path: string,
        body: any,
        accessToken?: string,
        shopId?: number,
        axiosConfig?: Partial<AxiosRequestConfig>
    ): Promise<T> {
        return shopeePost<T>(this.config, path, body, accessToken, shopId, axiosConfig);
    }
}

export { SHOPEE_API_BASE_URL };
