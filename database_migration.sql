-- Migration untuk implementasi sinkronisasi escrow_amount_after_adjustment antara tabel orders dan order_escrow
-- Tanggal: 2023-11-28

-- 1. Fungsi untuk menyinkronkan nilai escrow_amount_after_adjustment antara tabel orders dan order_escrow
CREATE OR REPLACE FUNCTION sync_escrow_amount_after_adjustment() RETURNS TRIGGER AS $$ 
BEGIN 
  -- Mencegah rekursi (infinite loop) dari trigger yang saling memanggil
  IF TG_OP = 'UPDATE' AND OLD.escrow_amount_after_adjustment IS NOT DISTINCT FROM NEW.escrow_amount_after_adjustment THEN
    RETURN NEW;
  END IF;

  -- Nilai default jika NULL
  IF NEW.escrow_amount_after_adjustment IS NULL THEN
    NEW.escrow_amount_after_adjustment := 0;
  END IF;

  -- Jika update pada tabel order_escrow
  IF TG_TABLE_NAME = 'order_escrow' THEN 
    -- Update nilai di tabel orders jika order_sn ada
    UPDATE orders SET 
      escrow_amount_after_adjustment = NEW.escrow_amount_after_adjustment 
    WHERE 
      order_sn = NEW.order_sn 
      AND (escrow_amount_after_adjustment IS NULL OR escrow_amount_after_adjustment IS DISTINCT FROM NEW.escrow_amount_after_adjustment);
  
  -- Jika update pada tabel orders
  ELSIF TG_TABLE_NAME = 'orders' THEN 
    -- Update nilai di tabel order_escrow jika order_sn ada
    UPDATE order_escrow SET 
      escrow_amount_after_adjustment = NEW.escrow_amount_after_adjustment 
    WHERE 
      order_sn = NEW.order_sn 
      AND (escrow_amount_after_adjustment IS NULL OR escrow_amount_after_adjustment IS DISTINCT FROM NEW.escrow_amount_after_adjustment);
  END IF;
  
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

-- 2. Trigger untuk menyinkronkan nilai escrow_amount_after_adjustment dari order_escrow ke orders
DROP TRIGGER IF EXISTS trg_sync_escrow_amount_from_escrow ON public.order_escrow;
CREATE TRIGGER trg_sync_escrow_amount_from_escrow 
AFTER INSERT OR UPDATE OF escrow_amount_after_adjustment 
ON public.order_escrow 
FOR EACH ROW 
EXECUTE FUNCTION sync_escrow_amount_after_adjustment();

-- 3. Trigger untuk menyinkronkan nilai escrow_amount_after_adjustment dari orders ke order_escrow
DROP TRIGGER IF EXISTS trg_sync_escrow_amount_from_orders ON public.orders;
CREATE TRIGGER trg_sync_escrow_amount_from_orders 
AFTER INSERT OR UPDATE OF escrow_amount_after_adjustment 
ON public.orders 
FOR EACH ROW 
EXECUTE FUNCTION sync_escrow_amount_after_adjustment();

-- 4. Mengisi nilai escrow_amount_after_adjustment yang NULL menjadi 0 pada kedua tabel
UPDATE public.orders SET escrow_amount_after_adjustment = 0 WHERE escrow_amount_after_adjustment IS NULL;
UPDATE public.order_escrow SET escrow_amount_after_adjustment = 0 WHERE escrow_amount_after_adjustment IS NULL;

-- 5. Menyinkronkan nilai awal dari tabel order_escrow ke orders
UPDATE public.orders o 
SET escrow_amount_after_adjustment = oe.escrow_amount_after_adjustment
FROM public.order_escrow oe 
WHERE o.order_sn = oe.order_sn 
AND oe.escrow_amount_after_adjustment IS NOT NULL
AND (o.escrow_amount_after_adjustment IS NULL OR o.escrow_amount_after_adjustment = 0);

-- 6. Menyinkronkan nilai awal dari tabel orders ke order_escrow
UPDATE public.order_escrow oe 
SET escrow_amount_after_adjustment = o.escrow_amount_after_adjustment
FROM public.orders o 
WHERE o.order_sn = oe.order_sn 
AND o.escrow_amount_after_adjustment IS NOT NULL
AND (oe.escrow_amount_after_adjustment IS NULL OR oe.escrow_amount_after_adjustment = 0); 