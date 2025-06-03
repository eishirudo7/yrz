-- Migration untuk menambahkan kolom tracking dan print management
-- Jalankan ini jika tabel booking_orders sudah ada sebelumnya

-- Tambahkan kolom baru jika belum ada
DO $$ 
BEGIN
    -- Tambah kolom tracking_number
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'booking_orders' 
        AND column_name = 'tracking_number'
    ) THEN
        ALTER TABLE booking_orders ADD COLUMN tracking_number TEXT;
        COMMENT ON COLUMN booking_orders.tracking_number IS 'Nomor resi/tracking dari kurir pengiriman';
    END IF;

    -- Tambah kolom is_printed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'booking_orders' 
        AND column_name = 'is_printed'
    ) THEN
        ALTER TABLE booking_orders ADD COLUMN is_printed BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN booking_orders.is_printed IS 'Status apakah dokumen pengiriman sudah dicetak';
    END IF;

    -- Tambah kolom document_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'booking_orders' 
        AND column_name = 'document_status'
    ) THEN
        ALTER TABLE booking_orders ADD COLUMN document_status TEXT DEFAULT 'PENDING';
        COMMENT ON COLUMN booking_orders.document_status IS 'Status dokumen: PENDING, READY, PRINTED, ERROR';
    END IF;
END $$;

-- Buat index baru untuk kolom yang ditambahkan
CREATE INDEX IF NOT EXISTS idx_booking_orders_tracking_number ON booking_orders(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_orders_is_printed ON booking_orders(is_printed);
CREATE INDEX IF NOT EXISTS idx_booking_orders_document_status ON booking_orders(document_status) WHERE document_status IS NOT NULL;

-- Update data existing jika diperlukan
-- Set default values untuk record yang sudah ada
UPDATE booking_orders 
SET is_printed = FALSE 
WHERE is_printed IS NULL;

UPDATE booking_orders 
SET document_status = 'PENDING' 
WHERE document_status IS NULL;

-- Contoh update untuk booking yang sudah shipped tapi belum ada tracking
-- UPDATE booking_orders 
-- SET document_status = 'READY'
-- WHERE booking_status = 'SHIPPED' 
-- AND tracking_number IS NOT NULL 
-- AND document_status = 'PENDING';

COMMIT; 