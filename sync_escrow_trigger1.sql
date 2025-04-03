-- Trigger untuk menyinkronkan nilai escrow_amount_after_adjustment dari order_escrow ke orders
-- Trigger ini akan dijalankan setelah INSERT atau UPDATE pada kolom escrow_amount_after_adjustment di tabel order_escrow
CREATE TRIGGER trg_sync_escrow_amount_from_escrow 
AFTER INSERT OR UPDATE OF escrow_amount_after_adjustment 
ON public.order_escrow 
FOR EACH ROW 
EXECUTE FUNCTION sync_escrow_amount_after_adjustment();
