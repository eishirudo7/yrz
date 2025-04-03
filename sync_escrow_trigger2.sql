-- Trigger untuk menyinkronkan nilai escrow_amount_after_adjustment dari orders ke order_escrow
-- Trigger ini akan dijalankan setelah INSERT atau UPDATE pada kolom escrow_amount_after_adjustment di tabel orders
CREATE TRIGGER trg_sync_escrow_amount_from_orders 
AFTER INSERT OR UPDATE OF escrow_amount_after_adjustment 
ON public.orders 
FOR EACH ROW 
EXECUTE FUNCTION sync_escrow_amount_after_adjustment();
