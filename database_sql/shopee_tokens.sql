create table public.shopee_tokens (
  id bigint generated by default as identity not null,
  shop_id bigint not null,
  shop_name text not null,
  partner_id bigint not null,
  access_token text not null,
  refresh_token text not null,
  access_token_expiry timestamp with time zone not null,
  refresh_token_expiry timestamp with time zone not null,
  authorization_expiry timestamp with time zone not null,
  last_refresh_attempt timestamp with time zone null,
  refresh_count integer null default 0,
  is_active boolean null default true,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  user_id uuid null,
  constraint shopee_tokens_pkey primary key (id),
  constraint shopee_tokens_shop_id_key unique (shop_id),
  constraint shopee_tokens_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_shopee_tokens_shop_id on public.shopee_tokens using btree (shop_id) TABLESPACE pg_default;

create index IF not exists idx_shop_id on public.shopee_tokens using btree (shop_id) TABLESPACE pg_default;

create index IF not exists idx_shop_name on public.shopee_tokens using btree (shop_name) TABLESPACE pg_default;

create index IF not exists idx_is_active on public.shopee_tokens using btree (is_active) TABLESPACE pg_default;

create trigger enforce_shop_limit BEFORE INSERT on shopee_tokens for EACH row
execute FUNCTION check_shop_limit_before_insert ();

create trigger trg_add_auto_ship_chat
after INSERT on shopee_tokens for EACH row
execute FUNCTION add_auto_ship_chat_entry ();

create trigger on_shopee_tokens_update
after
update on shopee_tokens for EACH row
execute FUNCTION manage_auto_ship_chat_rows ();