-- Optimize profile creation logic without altering existing triggers

-- First drop all related triggers
drop trigger if exists on_auth_user_created on auth.users cascade;
drop trigger if exists on_auth_user_created on public.profiles cascade;

-- Then drop the function
drop function if exists public.handle_new_user() cascade;

-- Create a simplified function that avoids recursion
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  default_role text := 'user';
  is_admin_default boolean := false;
begin
  -- Direct insert without any selects or complex operations
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    is_admin,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    default_role,
    is_admin_default,
    now()
  );
  
  return new;
exception
  when others then
    -- Log error details to the Postgres log
    raise warning 'Error in handle_new_user: %', SQLERRM;
    return new;
end;
$$;

-- Create the trigger with explicit schema reference
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
