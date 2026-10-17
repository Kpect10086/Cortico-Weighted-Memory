CREATE TABLE IF NOT EXISTS raw_messages (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, text TEXT NOT NULL,
  receivedAt INTEGER NOT NULL, speaker TEXT NOT NULL, run TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS raw_messages_scope ON raw_messages(scope,receivedAt);
CREATE INDEX IF NOT EXISTS audit_record ON audit(recordId);
CREATE TABLE IF NOT EXISTS migration_sources (recordId TEXT PRIMARY KEY, batch TEXT NOT NULL, previousState TEXT NOT NULL);
CREATE VIEW IF NOT EXISTS memory_candidates AS SELECT * FROM records WHERE state='pending';
CREATE VIEW IF NOT EXISTS long_term_memories AS SELECT * FROM records WHERE state='active' AND kind NOT IN ('raw','archive');
