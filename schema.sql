CREATE TABLE IF NOT EXISTS notebook (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  color       TEXT DEFAULT '#C4A882',
  emoji       TEXT DEFAULT '🧪',
  goal        TEXT DEFAULT '',
  tracked     INTEGER DEFAULT 1,
  sort_order  INTEGER DEFAULT 0,
  created     TEXT DEFAULT (datetime('now')),
  updated     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  drawings    TEXT DEFAULT '[]',
  sort_order  INTEGER DEFAULT 0,
  created     TEXT DEFAULT (datetime('now')),
  updated     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS block (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('text', 'image', 'molecule', 'chat_response', 'document', 'data')),
  content     TEXT,
  image_url   TEXT,
  metadata    TEXT,
  sort_order  INTEGER DEFAULT 0,
  created     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_message (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  model       TEXT,
  created     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS smiles_cache (
  input   TEXT PRIMARY KEY,
  smiles  TEXT NOT NULL,
  created TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS next_steps (
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  steps       TEXT NOT NULL DEFAULT '[]',
  generated   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (notebook_id)
);

CREATE TABLE IF NOT EXISTS next_steps_history (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  step        TEXT NOT NULL,
  created     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_notebook ON page(notebook_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_block_page ON block(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chat_notebook ON chat_message(notebook_id, created);
