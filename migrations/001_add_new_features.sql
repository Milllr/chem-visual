-- Migration: Add melting_point, optical_rotation to compound; add timer table; update block CHECK for 'tlc'
-- Run: npx wrangler d1 execute chem-journal --file=migrations/001_add_new_features.sql

-- 1. Add new columns to compound table (IF NOT EXISTS not supported for ALTER, so use try-style)
ALTER TABLE compound ADD COLUMN melting_point TEXT DEFAULT '';
ALTER TABLE compound ADD COLUMN optical_rotation TEXT DEFAULT '';

-- 2. Create timer table
CREATE TABLE IF NOT EXISTS timer (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  page_id     TEXT REFERENCES page(id) ON DELETE SET NULL,
  label       TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT,
  created     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timer_notebook ON timer(notebook_id);

-- 3. Recreate block table with updated CHECK constraint to include 'tlc'
--    SQLite doesn't allow ALTER CHECK, so we recreate the table
CREATE TABLE IF NOT EXISTS block_new (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('text', 'image', 'molecule', 'chat_response', 'document', 'data', 'reaction_step', 'tlc')),
  content     TEXT,
  image_url   TEXT,
  metadata    TEXT,
  sort_order  INTEGER DEFAULT 0,
  created     TEXT DEFAULT (datetime('now'))
);

INSERT INTO block_new SELECT * FROM block;
DROP TABLE block;
ALTER TABLE block_new RENAME TO block;

CREATE INDEX IF NOT EXISTS idx_block_page ON block(page_id, sort_order);
