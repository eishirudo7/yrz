create table public.user_subscriptions (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  plan_id uuid not null,
  status text not null,
  start_date timestamp with time zone not null default now(),
  end_date timestamp with time zone null,
  payment_status text null,
  payment_reference text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_subscriptions_pkey primary key (id),
  constraint user_subscriptions_plan_id_fkey foreign KEY (plan_id) references subscription_plans (id),
  constraint user_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_subscriptions_status_check check (
    (
      status = any (
        array[
          'active'::text,
          'cancelled'::text,
          'expired'::text,
          'trial'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create trigger update_user_subscriptions_updated_at BEFORE
update on user_subscriptions for EACH row
execute FUNCTION update_updated_at_column ();