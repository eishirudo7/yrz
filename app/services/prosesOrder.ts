import { processReadyToShipOrders } from "@/app/services/shopeeService";

export async function prosesOrder(shopId: number, orderSn: string, shippingMethod: string = 'dropoff'): Promise<any> {
    // Menambahkan delay 6 detik
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const shipResult = await processReadyToShipOrders(shopId, orderSn, shippingMethod);
    
    
    
    return shipResult;
}
