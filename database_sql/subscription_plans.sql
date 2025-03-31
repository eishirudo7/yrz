create table public.subscription_plans (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  description text null,
  price numeric(10, 2) not null,
  max_shops integer not null,
  features jsonb null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint subscription_plans_pkey primary key (id),
  constraint subscription_plans_name_key unique (name)
) TABLESPACE pg_default;

create trigger update_subscription_plans_updated_at BEFORE
update on subscription_plans for EACH row
execute FUNCTION update_updated_at_column ();