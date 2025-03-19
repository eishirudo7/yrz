create view public.dashboard_view as
with
  sku_totals as (
    select
      o.order_sn,
      o.shop_id,
      st.shop_name,
      o.order_status,
      o.cod,
      oi.item_sku,
      o.buyer_user_id,
      sum(oi.model_quantity_purchased) as total_quantity,
      sum(
        oi.model_discounted_price::numeric * oi.model_quantity_purchased::numeric
      ) as total_amount,
      o.create_time,
      o.update_time,
      o.pay_time,
      o.buyer_username,
      o.shipping_carrier,
      l.tracking_number,
      l.document_status,
      l.is_printed
    from
      orders o
      join shopee_tokens st on o.shop_id = st.shop_id
      left join logistic l on o.order_sn::text = l.order_sn::text
      left join order_items oi on o.order_sn::text = oi.order_sn::text
    where
      st.is_active = true
      and (
        o.order_status::text = any (
          array[
            'READY_TO_SHIP'::text,
            'PROCESSED'::text,
            'IN_CANCEL'::text,
            'TO_RETURN'::text
          ]
        )
      )
      or o.order_status::text = 'CANCELLED'::text
      and (
        to_timestamp(o.pay_time::double precision) AT TIME ZONE 'Asia/Jakarta'::text
      )::date = (
        CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text
      )::date
      or o.order_status::text = 'SHIPPED'::text
      and (
        to_timestamp(o.update_time::double precision) AT TIME ZONE 'Asia/Jakarta'::text
      )::date = (
        CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text
      )::date
    group by
      o.order_sn,
      o.shop_id,
      st.shop_name,
      o.cod,
      o.order_status,
      o.buyer_user_id,
      o.create_time,
      o.update_time,
      o.pay_time,
      o.buyer_username,
      o.shipping_carrier,
      l.tracking_number,
      l.document_status,
      l.is_printed,
      oi.item_sku
  )
select
  sku_totals.order_sn,
  sku_totals.shop_id,
  sku_totals.shop_name,
  sku_totals.order_status,
  sku_totals.cod,
  sku_totals.buyer_user_id,
  sum(sku_totals.total_amount) as total_amount,
  max(sku_totals.create_time) as create_time,
  max(sku_totals.update_time) as update_time,
  max(sku_totals.pay_time) as pay_time,
  max(sku_totals.buyer_username::text) as buyer_username,
  max(sku_totals.shipping_carrier::text) as shipping_carrier,
  max(sku_totals.tracking_number) as tracking_number,
  max(sku_totals.document_status) as document_status,
  bool_or(sku_totals.is_printed) as is_printed,
  string_agg(
    distinct (
      (sku_totals.item_sku::text || ' ('::text) || sku_totals.total_quantity::text
    ) || ')'::text,
    ', '::text
  ) as sku_qty
from
  sku_totals
group by
  sku_totals.order_sn,
  sku_totals.shop_id,
  sku_totals.shop_name,
  sku_totals.order_status,
  sku_totals.cod,
  sku_totals.buyer_user_id
order by
  (
    COALESCE(
      max(sku_totals.pay_time),
      max(sku_totals.create_time)
    )
  ) desc;



  create view public.orders_view as
with
  sku_totals as (
    select
      o.order_sn,
      o.shop_id,
      st.shop_name,
      o.order_status,
      o.cod,
      oi.item_sku,
      o.buyer_user_id,
      sum(oi.model_quantity_purchased) as total_quantity,
      sum(
        oi.model_discounted_price::numeric * oi.model_quantity_purchased::numeric
      ) as total_amount,
      o.create_time,
      o.update_time,
      o.pay_time,
      o.buyer_username,
      o.shipping_carrier,
      l.tracking_number,
      l.document_status,
      l.is_printed,
      o.cancel_reason
    from
      orders o
      join shopee_tokens st on o.shop_id = st.shop_id
      left join logistic l on o.order_sn::text = l.order_sn::text
      left join order_items oi on o.order_sn::text = oi.order_sn::text
    where
      st.is_active = true
    group by
      o.order_sn,
      o.shop_id,
      st.shop_name,
      o.cod,
      o.order_status,
      o.buyer_user_id,
      o.create_time,
      o.update_time,
      o.pay_time,
      o.buyer_username,
      o.shipping_carrier,
      l.tracking_number,
      l.document_status,
      l.is_printed,
      oi.item_sku,
      o.cancel_reason
  )
select
  sku_totals.order_sn,
  sku_totals.shop_id,
  sku_totals.shop_name,
  sku_totals.order_status,
  sku_totals.cod,
  sku_totals.buyer_user_id,
  sum(sku_totals.total_amount) as total_amount,
  max(sku_totals.create_time) as create_time,
  max(sku_totals.update_time) as update_time,
  max(sku_totals.pay_time) as pay_time,
  max(sku_totals.buyer_username::text) as buyer_username,
  max(sku_totals.shipping_carrier::text) as shipping_carrier,
  max(sku_totals.tracking_number) as tracking_number,
  max(sku_totals.document_status) as document_status,
  bool_or(sku_totals.is_printed) as is_printed,
  string_agg(
    distinct (
      (sku_totals.item_sku::text || ' ('::text) || sku_totals.total_quantity::text
    ) || ')'::text,
    ', '::text
  ) as sku_qty,
  max(sku_totals.cancel_reason) as cancel_reason
from
  sku_totals
group by
  sku_totals.order_sn,
  sku_totals.shop_id,
  sku_totals.shop_name,
  sku_totals.order_status,
  sku_totals.cod,
  sku_totals.buyer_user_id
order by
  (
    COALESCE(
      max(sku_totals.pay_time),
      max(sku_totals.create_time)
    )
  ) desc;