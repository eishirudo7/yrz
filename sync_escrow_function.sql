-- Function untuk menyinkronkan nilai escrow_amount_after_adjustment antara tabel orders dan order_escrow
-- Fungsi ini akan dijalankan ketika ada INSERT atau UPDATE pada kolom escrow_amount_after_adjustment
-- di salah satu tabel (orders atau order_escrow)
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
