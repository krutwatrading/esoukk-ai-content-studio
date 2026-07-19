insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('campaign-assets','campaign-assets',true,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
