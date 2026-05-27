-- Web Audit Feature Tables
-- Run this in Supabase SQL Editor

-- audit_targets: queue of URLs to discover and audit
CREATE TABLE IF NOT EXISTS audit_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  business_name TEXT,
  business_type TEXT,
  location TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'auditing', 'completed', 'failed', 'skipped')),
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  audited_at TIMESTAMP WITH TIME ZONE,
  audit_id UUID
);

-- web_audits: one audit record per URL run
CREATE TABLE IF NOT EXISTS web_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_id UUID REFERENCES audit_targets(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  business_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  overall_score INT CHECK (overall_score >= 0 AND overall_score <= 100),
  progress_pct INT DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add FK from audit_targets to web_audits (after both tables exist)
ALTER TABLE audit_targets
  ADD CONSTRAINT fk_audit_targets_audit_id
  FOREIGN KEY (audit_id) REFERENCES web_audits(id) ON DELETE SET NULL;

-- audit_checks: individual check results per audit (streamed in as each check completes)
CREATE TABLE IF NOT EXISTS audit_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES web_audits(id) ON DELETE CASCADE,
  check_name TEXT NOT NULL,
  dimension TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'warning', 'error')),
  score INT DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  findings JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (audit_id, check_name)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_targets_status ON audit_targets(status);
CREATE INDEX IF NOT EXISTS idx_web_audits_status ON web_audits(status);
CREATE INDEX IF NOT EXISTS idx_web_audits_created_at ON web_audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_checks_audit_id ON audit_checks(audit_id);

-- RLS: Admin-only access (these tables have no client-facing data)
ALTER TABLE audit_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_checks ENABLE ROW LEVEL SECURITY;

-- Only service role (admin client) can access these tables
-- No public policies needed since all access goes through service role key
