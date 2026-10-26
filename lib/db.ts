import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalDatabase = globalThis as typeof globalThis & {
  taskspaceDatabase?: DatabaseSync;
};

export function getDatabase() {
  if (!globalDatabase.taskspaceDatabase) {
    // This is runtime data, so it must not be bundled as a deployment asset.
    const path = resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH ?? "data/taskspace.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    const database = new DatabaseSync(path);
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS google_accounts (
        subject TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS google_oauth_requests (
        state_hash TEXT PRIMARY KEY,
        browser_hash TEXT NOT NULL,
        code_verifier TEXT NOT NULL,
        nonce TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS google_oauth_expiry ON google_oauth_requests(expires_at);
    `);
    globalDatabase.taskspaceDatabase = database;
  }

  return globalDatabase.taskspaceDatabase;
}
