create table public.user_roles (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  role_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_roles_pkey primary key (id),
  constraint user_roles_user_id_role_id_key unique (user_id, role_id),
  constraint user_roles_role_id_fkey foreign KEY (role_id) references roles (id) on delete CASCADE,
  constraint user_roles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_user_roles_updated_at BEFORE
update on user_roles for EACH row
execute FUNCTION update_updated_at_column ();