/**
 * Shopee API - Authentication Module
 * Handles OAuth authentication, token management, and shop authorization
 */

import axios from 'axios';
import { ShopeeClient, SHOPEE_API_BASE_URL } from './client';

/**
 * Generate shop authorization URL
 */
export function generateAuthUrl(client: ShopeeClient, redirectUrl: string): string {
    const path = '/api/v2/shop/auth_partner';
    const { timestamp, sign } = client.generateSignature(path);

    const params = new URLSearchParams({
        partner_id: client.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
        redirect: redirectUrl
    });

    return `${SHOPEE_API_BASE_URL}${path}?${params.toString()}`;
}

/**
 * Generate shop de-authorization URL
 */
export function generateDeauthUrl(client: ShopeeClient, redirectUrl: string): string {
    const path = '/api/v2/shop/cancel_auth_partner';
    const { timestamp, sign } = client.generateSignature(path);

    const params = new URLSearchParams({
        partner_id: client.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
        redirect: redirectUrl
    });

    return `${SHOPEE_API_BASE_URL}${path}?${params.toString()}`;
}

/**
 * Get initial access and refresh tokens using authorization code
 */
export async function getTokens(
    client: ShopeeClient,
    code: string,
    shopId: number
): Promise<any> {
    const path = '/api/v2/auth/token/get';
    const { timestamp, sign } = client.generateSignature(path);

    const body = {
        code,
        shop_id: shopId,
        partner_id: client.partnerId
    };

    const url = `${SHOPEE_API_BASE_URL}${path}?partner_id=${client.partnerId}&timestamp=${timestamp}&sign=${sign}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response = await axios.post(url, body, { headers });
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

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
    client: ShopeeClient,
    refreshToken: string,
    shopId: number
): Promise<any> {
    const path = '/api/v2/auth/access_token/get';
    const { timestamp, sign } = client.generateSignature(path);

    const body = {
        refresh_token: refreshToken,
        shop_id: shopId,
        partner_id: client.partnerId
    };

    const url = `${SHOPEE_API_BASE_URL}${path}?partner_id=${client.partnerId}&timestamp=${timestamp}&sign=${sign}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response = await axios.post(url, body, { headers });
        return response.data;
    } catch (error) {
        console.error('Shopee API Error:', error);
        throw error;
    }
}

/**
 * Get shop information
 */
export async function getShopInfo(
    client: ShopeeClient,
    shopId: number,
    accessToken: string
): Promise<any> {
    const params = new URLSearchParams({
        entry_list: 'shop_name'
    });

    return client.get('/api/v2/shop/get_shop_info', params, accessToken, shopId);
}
