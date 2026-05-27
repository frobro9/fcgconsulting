-- Add 'approved' to requests.status check constraint
-- This status is set when client approves the ad; admin then manually marks 'completed'

ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending', 'quoted', 'in_progress', 'awaiting_approval', 'approved', 'completed', 'rejected'));
