-- Drop the trigger first
drop trigger if exists on_auth_user_created on auth.users;

-- Update the function without dropping it
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
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
        coalesce(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            split_part(new.email, '@', 1)
        ),
        coalesce(
            new.raw_user_meta_data->>'avatar_url',
            new.raw_user_meta_data->>'picture'
        ),
        'user',
        false,
        now()
    );
    return new;
end;
$$;

-- Recreate the trigger
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
