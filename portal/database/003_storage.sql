-- Storage bucket for request attachments
-- Run this in the Supabase SQL editor after creating the bucket via the dashboard,
-- OR the bucket can be created via this SQL directly.

insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload files
create policy "Authenticated users can upload attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'request-attachments'
    and auth.role() = 'authenticated'
  );

-- Allow public read access (URLs stored in request_attachments are already RLS-protected)
create policy "Public can read attachments"
  on storage.objects for select
  using (bucket_id = 'request-attachments');
