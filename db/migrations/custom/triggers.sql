-- Trigger functions dan triggers yang perlu direplikasi dari Supabase
-- Jalankan setelah tabel sudah dibuat

-- ══════════════════════════════════════
-- TRIGGER FUNCTIONS
-- ══════════════════════════════════════

-- 1. Sync escrow_amount_after_adjustment antara orders ↔ order_escrow
CREATE OR REPLACE FUNCTION sync_escrow_amount_after_adjustment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.escrow_amount_after_adjustment IS NOT DISTINCT FROM NEW.escrow_amount_after_adjustment THEN
    RETURN NEW;
  END IF;

  IF NEW.escrow_amount_after_adjustment IS NULL THEN
    NEW.escrow_amount_after_adjustment := 0;
  END IF;

  IF TG_TABLE_NAME = 'order_escrow' THEN
    UPDATE orders SET
      escrow_amount_after_adjustment = NEW.escrow_amount_after_adjustment
    WHERE
      order_sn = NEW.order_sn
      AND (escrow_amount_after_adjustment IS NULL OR escrow_amount_after_adjustment IS DISTINCT FROM NEW.escrow_amount_after_adjustment);

  ELSIF TG_TABLE_NAME = 'orders' THEN
    UPDATE order_escrow SET
      escrow_amount_after_adjustment = NEW.escrow_amount_after_adjustment
    WHERE
      order_sn = NEW.order_sn
      AND (escrow_amount_after_adjustment IS NULL OR escrow_amount_after_adjustment IS DISTINCT FROM NEW.escrow_amount_after_adjustment);
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Sync tracking_number dari orders ke logistic
CREATE OR REPLACE FUNCTION update_logistic_tracking_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE logistic
  SET tracking_number = NEW.tracking_number
  WHERE logistic.order_sn = NEW.order_sn;
  RETURN NEW;
END;
$$;

-- 3. Auto-add entry ke auto_ship_chat saat shopee_tokens baru ditambah
CREATE OR REPLACE FUNCTION add_auto_ship_chat_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auto_ship_chat (shop_id, status_chat, status_ship)
  VALUES (NEW.shop_id, false, false);
  RETURN NEW;
END;
$$;

-- 4. Manage auto_ship_chat saat is_active berubah di shopee_tokens
CREATE OR REPLACE FUNCTION manage_auto_ship_chat_rows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    DELETE FROM auto_ship_chat WHERE shop_id = OLD.shop_id;
  ELSIF OLD.is_active = false AND NEW.is_active = true THEN
    INSERT INTO auto_ship_chat (shop_id) VALUES (NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 6. Auto-update booking_orders.updated_at
CREATE OR REPLACE FUNCTION update_booking_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════

-- order_escrow: sync escrow_amount ke orders
DROP TRIGGER IF EXISTS trg_sync_escrow_amount_from_escrow ON order_escrow;
CREATE TRIGGER trg_sync_escrow_amount_from_escrow
  BEFORE INSERT OR UPDATE ON order_escrow
  FOR EACH ROW
  EXECUTE FUNCTION sync_escrow_amount_after_adjustment();

-- orders: sync tracking_number ke logistic
DROP TRIGGER IF EXISTS sync_tracking_number_to_logistic ON orders;
CREATE TRIGGER sync_tracking_number_to_logistic
  AFTER UPDATE OF tracking_number ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_logistic_tracking_number();

-- shopee_tokens: auto-add auto_ship_chat entry
DROP TRIGGER IF EXISTS trg_add_auto_ship_chat ON shopee_tokens;
CREATE TRIGGER trg_add_auto_ship_chat
  AFTER INSERT ON shopee_tokens
  FOR EACH ROW
  EXECUTE FUNCTION add_auto_ship_chat_entry();

-- shopee_tokens: manage auto_ship_chat on is_active change
DROP TRIGGER IF EXISTS on_shopee_tokens_update ON shopee_tokens;
CREATE TRIGGER on_shopee_tokens_update
  AFTER UPDATE OF is_active ON shopee_tokens
  FOR EACH ROW
  EXECUTE FUNCTION manage_auto_ship_chat_rows();

-- booking_orders: auto-update updated_at
DROP TRIGGER IF EXISTS trigger_booking_orders_updated_at ON booking_orders;
CREATE TRIGGER trigger_booking_orders_updated_at
  BEFORE UPDATE ON booking_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_orders_updated_at();

-- subscription_plans: auto-update updated_at
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- user_subscriptions: auto-update updated_at
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
