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

CREATE TABLE IF NOT EXISTS reagent_cache (
  cas         TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  created     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reagent (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  cas         TEXT NOT NULL,
  name        TEXT NOT NULL,
  formula     TEXT DEFAULT '',
  molar_mass  REAL DEFAULT 0,
  smiles      TEXT DEFAULT '',
  density     REAL,
  description TEXT DEFAULT '',
  hazards     TEXT DEFAULT '[]',
  metadata    TEXT DEFAULT '{}',
  sort_order  INTEGER DEFAULT 0,
  created     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reaction (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Untitled Reaction',
  target_smiles TEXT DEFAULT '',
  target_name TEXT DEFAULT '',
  target_mass REAL DEFAULT 0,
  steps       TEXT DEFAULT '[]',
  metadata    TEXT DEFAULT '{}',
  sort_order  INTEGER DEFAULT 0,
  created     TEXT DEFAULT (datetime('now')),
  updated     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_notebook ON page(notebook_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_block_page ON block(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chat_notebook ON chat_message(notebook_id, created);
CREATE INDEX IF NOT EXISTS idx_reagent_notebook ON reagent(notebook_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_reagent_cas ON reagent(cas);
CREATE INDEX IF NOT EXISTS idx_reaction_notebook ON reaction(notebook_id, sort_order);

CREATE TABLE IF NOT EXISTS compound (
  id                TEXT PRIMARY KEY,
  notebook_id       TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  name              TEXT NOT NULL DEFAULT '',
  smiles            TEXT DEFAULT '',
  formula           TEXT DEFAULT '',
  molar_mass        REAL DEFAULT 0,
  reaction_id       TEXT REFERENCES reaction(id) ON DELETE SET NULL,
  actual_yield      REAL DEFAULT 0,
  theoretical_yield REAL DEFAULT 0,
  yield_percent     REAL DEFAULT 0,
  nmr_data          TEXT DEFAULT '{}',
  mass_spec         INTEGER DEFAULT 0,
  mass_spec_type    TEXT DEFAULT '',
  mass_spec_notes   TEXT DEFAULT '',
  ir_data           INTEGER DEFAULT 0,
  ir_notes          TEXT DEFAULT '',
  crystal           INTEGER DEFAULT 0,
  crystal_notes     TEXT DEFAULT '',
  notes             TEXT DEFAULT '',
  metadata          TEXT DEFAULT '{}',
  sort_order        INTEGER DEFAULT 0,
  created           TEXT DEFAULT (datetime('now')),
  updated           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compound_notebook ON compound(notebook_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_compound_reaction ON compound(reaction_id);
