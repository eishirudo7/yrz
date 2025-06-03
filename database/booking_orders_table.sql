-- Tabel untuk menyimpan data booking orders dari Shopee API
CREATE TABLE IF NOT EXISTS booking_orders (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    booking_sn VARCHAR(50) NOT NULL,
    order_sn VARCHAR(50),
    region VARCHAR(10),
    booking_status VARCHAR(50),
    match_status VARCHAR(50),
    shipping_carrier TEXT,
    create_time BIGINT,
    update_time BIGINT,
    recipient_address JSONB,
    item_list JSONB,
    dropshipper TEXT,
    dropshipper_phone VARCHAR(50),
    cancel_by VARCHAR(50),
    cancel_reason VARCHAR(100),
    fulfillment_flag VARCHAR(50),
    pickup_done_time BIGINT,
    tracking_number TEXT,
    is_printed BOOLEAN DEFAULT FALSE,
    document_status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(shop_id, booking_sn)
);

-- Index untuk performance
CREATE INDEX IF NOT EXISTS idx_booking_orders_shop_id ON booking_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_booking_orders_booking_sn ON booking_orders(booking_sn);
CREATE INDEX IF NOT EXISTS idx_booking_orders_order_sn ON booking_orders(order_sn) WHERE order_sn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_orders_booking_status ON booking_orders(booking_status) WHERE booking_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_orders_create_time ON booking_orders(create_time) WHERE create_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_orders_update_time ON booking_orders(update_time) WHERE update_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_orders_tracking_number ON booking_orders(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_orders_is_printed ON booking_orders(is_printed);
CREATE INDEX IF NOT EXISTS idx_booking_orders_document_status ON booking_orders(document_status) WHERE document_status IS NOT NULL;

-- Index untuk JSONB fields yang sering diquery
CREATE INDEX IF NOT EXISTS idx_booking_orders_recipient_address_gin ON booking_orders USING GIN(recipient_address);
CREATE INDEX IF NOT EXISTS idx_booking_orders_item_list_gin ON booking_orders USING GIN(item_list);

-- Function untuk auto-update timestamp
CREATE OR REPLACE FUNCTION update_booking_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk auto-update updated_at
CREATE TRIGGER trigger_booking_orders_updated_at
    BEFORE UPDATE ON booking_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_orders_updated_at();

-- RLS (Row Level Security) - opsional, sesuaikan dengan kebutuhan auth
ALTER TABLE booking_orders ENABLE ROW LEVEL SECURITY;

-- Policy contoh - sesuaikan dengan sistem auth Anda
-- CREATE POLICY "Users can view their own booking orders" ON booking_orders
--     FOR SELECT USING (
--         shop_id IN (
--             SELECT shop_id FROM shopee_tokens 
--             WHERE user_id = auth.uid() AND is_active = true
--         )
--     );

-- CREATE POLICY "Users can insert their own booking orders" ON booking_orders
--     FOR INSERT WITH CHECK (
--         shop_id IN (
--             SELECT shop_id FROM shopee_tokens 
--             WHERE user_id = auth.uid() AND is_active = true
--         )
--     );

-- CREATE POLICY "Users can update their own booking orders" ON booking_orders
--     FOR UPDATE USING (
--         shop_id IN (
--             SELECT shop_id FROM shopee_tokens 
--             WHERE user_id = auth.uid() AND is_active = true
--         )
--     );

-- Komentar untuk dokumentasi strukture JSONB
COMMENT ON TABLE booking_orders IS 'Tabel untuk menyimpan data booking orders dari Shopee API';
COMMENT ON COLUMN booking_orders.recipient_address IS 'JSONB berisi: name, phone, town, district, city, state, region, zipcode, full_address';
COMMENT ON COLUMN booking_orders.item_list IS 'JSONB array berisi: item_name, item_sku, model_name, model_sku, weight, product_location_id, image_info';
COMMENT ON COLUMN booking_orders.tracking_number IS 'Nomor resi/tracking dari kurir pengiriman';
COMMENT ON COLUMN booking_orders.is_printed IS 'Status apakah dokumen pengiriman sudah dicetak';
COMMENT ON COLUMN booking_orders.document_status IS 'Status dokumen: PENDING, READY, PRINTED, ERROR';

-- Contoh query untuk insert data
-- INSERT INTO booking_orders (
--     shop_id, booking_sn, order_sn, region, booking_status, match_status, 
--     shipping_carrier, create_time, update_time, recipient_address, item_list,
--     dropshipper, dropshipper_phone, cancel_by, cancel_reason, 
--     fulfillment_flag, pickup_done_time, tracking_number, is_printed, document_status
-- ) VALUES (
--     832664993,
--     '201214JASXYXY6',
--     '201218V2Y6E59M', 
--     'MY',
--     'CANCELLED',
--     'MATCH_PENDING',
--     'Standard Delivery',
--     1607930885,
--     1608134691,
--     '{"name": "Max", "phone": "3828203", "town": "Sara", "district": "Dada", "city": "Asajaya", "state": "Sarawak", "region": "MY", "zipcode": "40009", "full_address": "C-15-14 BLOK C JALAN 30/146, Asajaya, 40009, Sarawak"}',
--     '[{"item_name": "backpack", "item_sku": "sku", "model_name": "-", "model_sku": "-", "weight": 12, "product_location_id": "-", "image_info": {"image_url": "-"}}]',
--     '-',
--     '-',
--     'system',
--     'BACKEND_LOGISTICS_NOT_STARTED',
--     'fulfilled_by_shopee',
--     0,
--     'SPX12345678901',
--     false,
--     'PENDING'
-- );

-- Contoh query untuk mencari berdasarkan recipient address
-- SELECT * FROM booking_orders 
-- WHERE recipient_address->>'city' = 'Asajaya';

-- Contoh query untuk mencari berdasarkan item
-- SELECT * FROM booking_orders 
-- WHERE item_list @> '[{"item_name": "backpack"}]';

-- Contoh query untuk mencari booking dengan dokumen yang belum dicetak
-- SELECT * FROM booking_orders 
-- WHERE shop_id = 832664993 
-- AND is_printed = false 
-- AND document_status = 'READY';

-- Contoh query untuk mencari berdasarkan tracking number
-- SELECT * FROM booking_orders 
-- WHERE tracking_number = 'SPX12345678901'; 