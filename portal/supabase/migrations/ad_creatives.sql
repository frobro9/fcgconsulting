-- Ad Creatives table
-- Tracks Moda-generated ads attached to firm_creates requests

CREATE TABLE IF NOT EXISTS ad_creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,

  -- Ad copy provided by admin
  headline TEXT NOT NULL,
  body_copy TEXT,
  cta TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'google', 'twitter')),
  audience_description TEXT,

  -- Moda job tracking
  moda_job_id TEXT,
  moda_canvas_id TEXT,
  moda_status TEXT DEFAULT 'generating' CHECK (moda_status IN ('generating', 'processing', 'ready', 'failed')),

  -- Generated image (stored in Supabase after export from Moda)
  image_url TEXT,

  -- Approval workflow
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent_for_approval', 'approved', 'rejected', 'revision_requested')),
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,

  -- Only one active ad per request
  UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_creatives_request_id ON ad_creatives(request_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_status ON ad_creatives(status);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_moda_job_id ON ad_creatives(moda_job_id);

-- RLS: service role handles all access
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
