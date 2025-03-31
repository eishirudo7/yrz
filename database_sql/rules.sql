create table public.roles (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  description text null,
  created_at timestamp with time zone null default now(),
  constraint roles_pkey primary key (id),
  constraint roles_name_key unique (name),
  constraint roles_name_check check (
    (
      name = any (array['super_admin'::text, 'customer'::text])
    )
  )
) TABLESPACE pg_default;