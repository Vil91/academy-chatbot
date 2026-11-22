import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      program TEXT,
      lang TEXT,
      profile TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner, updated_at);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id, id);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attachment_id TEXT,
      conversation_id TEXT,
      month TEXT,
      amount REAL,
      currency TEXT,
      paid_date TEXT,
      payer TEXT,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      interest TEXT,
      preferred_time TEXT,
      lang TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handoffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT,
      owner TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      lang TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS excuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

// Housekeeping: expired sessions, old demo accounts, stale guest chats and unreferenced attachments.
export function cleanup(db) {
  db.exec(`
    DELETE FROM sessions WHERE expires_at <= datetime('now');
    DELETE FROM conversations WHERE owner IN (
      SELECT 'u:' || id FROM users WHERE is_demo = 1 AND created_at < datetime('now', '-2 days')
    );
    DELETE FROM attachments WHERE owner IN (
      SELECT 'u:' || id FROM users WHERE is_demo = 1 AND created_at < datetime('now', '-2 days')
    );
    DELETE FROM users WHERE is_demo = 1 AND created_at < datetime('now', '-2 days');
    DELETE FROM conversations WHERE owner LIKE 'g:%' AND updated_at < datetime('now', '-7 days');
    DELETE FROM attachments WHERE owner LIKE 'g:%' AND created_at < datetime('now', '-7 days');
    DELETE FROM attachments
      WHERE created_at < datetime('now', '-2 hours')
        AND id NOT IN (SELECT attachment_id FROM payment_proofs WHERE attachment_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.meta IS NOT NULL AND instr(m.meta, attachments.id) > 0);
  `);
}
