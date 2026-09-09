import { DatabaseSync } from 'node:sqlite';
export function openDatabase(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('player','developer','reviewer','admin')),
      verified INTEGER NOT NULL DEFAULT 0, suspended INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS account_tokens(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS games(
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('first-party','community')), color TEXT NOT NULL DEFAULT '#3659d9',
      active_release TEXT, revision INTEGER NOT NULL DEFAULT 0, disabled INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(id,active_release) REFERENCES releases(game_id,id)
    );
    CREATE TABLE IF NOT EXISTS releases(
      id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), version TEXT NOT NULL,
      html TEXT NOT NULL, sha256 TEXT NOT NULL, signature TEXT NOT NULL, bytes INTEGER NOT NULL, checks TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('candidate','approved','rejected','changes_requested')),
      approved_digest TEXT, created INTEGER NOT NULL, UNIQUE(game_id,version), UNIQUE(game_id,id)
    );
    CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES releases(id), reviewer_id TEXT NOT NULL REFERENCES users(id), decision TEXT NOT NULL, feedback TEXT NOT NULL, digest TEXT NOT NULL, checklist TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS previews(user_id TEXT NOT NULL REFERENCES users(id), release_id TEXT NOT NULL REFERENCES releases(id), digest TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(user_id,release_id));
    CREATE TABLE IF NOT EXISTS deployments(id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), release_id TEXT NOT NULL REFERENCES releases(id), previous_release TEXT, revision INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE(game_id,revision));
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES releases(id), user_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','resolved')), resolution TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS telemetry(id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES releases(id), event TEXT NOT NULL CHECK(event IN ('ready','load_failed','runtime_error')), created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, message TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, x TEXT NOT NULL REFERENCES users(id), o TEXT REFERENCES users(id), board TEXT NOT NULL DEFAULT '---------', turn TEXT NOT NULL DEFAULT 'X', state TEXT NOT NULL DEFAULT 'waiting', winner TEXT, revision INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS release_immutable BEFORE UPDATE OF game_id,version,html,sha256,signature,bytes,checks,created ON releases BEGIN SELECT RAISE(ABORT,'Release bytes and metadata are immutable'); END;
    CREATE INDEX IF NOT EXISTS telemetry_release ON telemetry(release_id,created);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
    CREATE INDEX IF NOT EXISTS matches_players ON matches(x,o,state);
    INSERT OR IGNORE INTO schema_migrations VALUES(1,unixepoch()*1000);
  `);
  if(!db.prepare('SELECT version FROM schema_migrations WHERE version=2').get()) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE users ADD COLUMN mfa_secret TEXT;
      ALTER TABLE users ADD COLUMN mfa_pending TEXT;
      ALTER TABLE users ADD COLUMN mfa_last_step INTEGER NOT NULL DEFAULT -1;
      INSERT INTO schema_migrations VALUES(2,unixepoch()*1000);
      COMMIT;`);
  }
  if(!db.prepare('SELECT version FROM schema_migrations WHERE version=3').get()) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE releases ADD COLUMN source_commit TEXT;
      CREATE TABLE ci_tokens(token_hash TEXT PRIMARY KEY,game_id TEXT NOT NULL REFERENCES games(id),expires INTEGER NOT NULL,actor TEXT NOT NULL,created INTEGER NOT NULL);
      CREATE TRIGGER release_provenance_immutable BEFORE UPDATE OF source_commit ON releases BEGIN SELECT RAISE(ABORT,'Release provenance is immutable'); END;
      CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
      CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
      INSERT INTO schema_migrations VALUES(3,unixepoch()*1000);
      COMMIT;`);
  }
  return db;
}
