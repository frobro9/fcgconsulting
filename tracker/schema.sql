-- fcg-tracker D1 schema
-- Apply:  wrangler d1 execute fcg-tracker --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS trackers (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('flight','item')),
  label           TEXT NOT NULL,
  url             TEXT NOT NULL,
  price_selector  TEXT,                       -- blank => try JSON-LD offers
  currency        TEXT NOT NULL DEFAULT 'CAD',
  target_price    REAL,                       -- optional; alert at/below this
  baseline_price  REAL,                       -- reference; set on first ok check
  last_price      REAL,
  last_checked_at TEXT,
  last_status     TEXT NOT NULL DEFAULT 'pending' CHECK (last_status IN ('pending','ok','error')),
  last_error      TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  interval_hours  INTEGER NOT NULL DEFAULT 6,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracker_checks (
  id         TEXT PRIMARY KEY,
  tracker_id TEXT NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  price      REAL,
  currency   TEXT,
  status     TEXT NOT NULL CHECK (status IN ('ok','error')),
  error      TEXT,
  notified   INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checks_tracker ON tracker_checks(tracker_id, checked_at DESC);
