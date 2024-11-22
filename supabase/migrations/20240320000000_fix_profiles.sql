-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Create profiles table if it doesn't exist
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    full_name text,
    avatar_url text,
    role text default 'user',
    is_admin boolean default false,
    club_id uuid references public.clubs(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone"
    on profiles for select
    using ( true );

create policy "Users can insert their own profile."
    on profiles for insert
    with check ( auth.uid() = id );

create policy "Users can update own profile."
    on profiles for update
    using ( auth.uid() = id );

-- Create indexes
create index if not exists profiles_id_index on public.profiles(id);
create index if not exists profiles_email_index on public.profiles(email);
create index if not exists profiles_club_id_index on public.profiles(club_id);

-- Function to handle user creation
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
            (new.raw_app_meta_data->>'full_name'),
            (new.raw_app_meta_data->>'name'),
            split_part(new.email, '@', 1)
        ),
        coalesce(
            (new.raw_app_meta_data->>'avatar_url'),
            (new.raw_app_meta_data->>'picture')
        ),
        'user',
        false,
        now()
    );
    return new;
end;
$$;

-- Create trigger for new user creation
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
