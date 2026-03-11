alter table if exists public.profiles
add column if not exists bio text not null default '';

alter table if exists public.profiles
drop constraint if exists profiles_bio_length;

alter table if exists public.profiles
add constraint profiles_bio_length
check (char_length(bio) <= 280);
