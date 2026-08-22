create extension if not exists "pgcrypto";

do $$ begin create type public.gallery_status as enum ('draft', 'published', 'archived'); exception when duplicate_object then null; end $$;

create table public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  description text check (description is null or char_length(description) <= 2000),
  event_date date,
  cover_image_path text,
  status public.gallery_status not null default 'draft',
  is_public boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null
);

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  caption text check (caption is null or char_length(caption) <= 500),
  alt_text text not null check (char_length(alt_text) between 1 and 300),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);

create index gallery_albums_status_event_date_idx on public.gallery_albums (status, event_date desc nulls last);
create index gallery_albums_public_event_date_idx on public.gallery_albums (event_date desc nulls last) where status = 'published' and is_public = true;
create index gallery_images_album_order_idx on public.gallery_images (album_id, display_order, created_at);

create or replace function public.set_gallery_album_audit_fields() returns trigger language plpgsql security invoker set search_path = public as $$ begin if tg_op = 'INSERT' then new.created_by = auth.uid(); end if; new.updated_by = auth.uid(); new.updated_at = now(); return new; end; $$;
create or replace function public.set_gallery_image_audit_fields() returns trigger language plpgsql security invoker set search_path = public as $$ begin if tg_op = 'INSERT' then new.created_by = auth.uid(); end if; return new; end; $$;
create trigger set_gallery_album_audit_fields before insert or update on public.gallery_albums for each row execute function public.set_gallery_album_audit_fields();
create trigger set_gallery_image_audit_fields before insert on public.gallery_images for each row execute function public.set_gallery_image_audit_fields();

alter table public.gallery_albums enable row level security;
alter table public.gallery_images enable row level security;
revoke all on public.gallery_albums, public.gallery_images from anon, authenticated;
grant select on public.gallery_albums, public.gallery_images to anon;
grant select, insert, update on public.gallery_albums to authenticated;
grant select, insert, update, delete on public.gallery_images to authenticated;

create policy "Public can read published gallery albums" on public.gallery_albums for select to anon, authenticated using (status = 'published' and is_public = true);
create policy "Active staff can read gallery albums" on public.gallery_albums for select to authenticated using (public.is_active_staff());
create policy "Active staff can create gallery albums" on public.gallery_albums for insert to authenticated with check (public.is_active_staff());
create policy "Active staff can update gallery albums" on public.gallery_albums for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "Public can read images from published gallery albums" on public.gallery_images for select to anon, authenticated using (exists (select 1 from public.gallery_albums a where a.id = album_id and a.status = 'published' and a.is_public = true));
create policy "Active staff can read gallery images" on public.gallery_images for select to authenticated using (public.is_active_staff());
create policy "Active staff can create gallery images" on public.gallery_images for insert to authenticated with check (public.is_active_staff());
create policy "Active staff can update gallery images" on public.gallery_images for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "Active staff can remove gallery images" on public.gallery_images for delete to authenticated using (public.is_active_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('gallery-media', 'gallery-media', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
create policy "Public can read eligible gallery media" on storage.objects for select to anon, authenticated using (bucket_id = 'gallery-media' and exists (select 1 from public.gallery_images i join public.gallery_albums a on a.id = i.album_id where i.storage_path = name and a.status = 'published' and a.is_public = true));
create policy "Active staff can read gallery media" on storage.objects for select to authenticated using (bucket_id = 'gallery-media' and public.is_active_staff());
create policy "Active staff can upload gallery media" on storage.objects for insert to authenticated with check (bucket_id = 'gallery-media' and public.is_active_staff());
create policy "Active staff can update gallery media" on storage.objects for update to authenticated using (bucket_id = 'gallery-media' and public.is_active_staff()) with check (bucket_id = 'gallery-media' and public.is_active_staff());
create policy "Active staff can remove gallery media" on storage.objects for delete to authenticated using (bucket_id = 'gallery-media' and public.is_active_staff());
