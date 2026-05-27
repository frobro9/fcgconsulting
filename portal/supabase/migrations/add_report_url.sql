-- Add report_url to web_audits to store generated PDF location
ALTER TABLE web_audits ADD COLUMN IF NOT EXISTS report_url TEXT;

-- Create storage bucket for audit PDF reports
-- Run this separately in Supabase Dashboard > Storage > New Bucket
-- Bucket name: audit-reports
-- Public: true (so PDFs can be downloaded via URL)
