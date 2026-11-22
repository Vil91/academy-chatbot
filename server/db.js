import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DEMO_CODE = 'DEMO-STUDENT';

// Demo student. The structure mirrors what a real student record would hold
// (schedule, exams, payments, attendance); the values are made up for the demo.
const DEMO_PROFILE = {
  code: DEMO_CODE,
  name: { hy: 'Արամ Պետրոսյան', ru: 'Арам Петросян', en: 'Aram Petrosyan' },
  firstName: { hy: 'Արամ', ru: 'Арам', en: 'Aram' },
  demo: true,
  program: 'AI-Native Product Engineering',
  group: 'Group A',
  schedule: [
    { day: 'Monday', time: '16:00–19:00', room: 'Ada Lovelace (1st floor)', topic: 'Databases: indexing' },
    { day: 'Tuesday', time: '16:00–19:00', room: 'Ada Lovelace (1st floor)', topic: 'SQL vs NoSQL' },
    { day: 'Wednesday', time: '16:00–19:00', room: 'Ada Lovelace (1st floor)', topic: 'Data modelling practice' },
    { day: 'Thursday', time: '16:00–19:00', room: 'Ada Lovelace (1st floor)', topic: 'Project: deploy a full web product' },
    { day: 'Friday', time: '17:00–18:00', room: 'Claude Shannon (2nd floor)', topic: 'Mastering English' },
  ],
  nextExam: { date: '2026-11-30', weekday: 'Monday', topic: 'SQL and NoSQL databases', format: 'online form, phone is fine' },
  payments: [
    { month: '2026-09', status: 'paid' },
    { month: '2026-10', status: 'paid' },
    { month: '2026-11', status: 'due', dueDate: '2026-11-25' },
  ],
  attendance: { percent: 88, attended: 22, total: 25, missed: 3 },
};

export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS students (
      code TEXT PRIMARY KEY,
      profile TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      interest TEXT,
      preferred_time TEXT,
      lang TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS handoffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      lang TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS excuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_code TEXT NOT NULL,
      date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      lang TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare('INSERT OR REPLACE INTO students (code, profile) VALUES (?, ?)').run(
    DEMO_CODE,
    JSON.stringify(DEMO_PROFILE),
  );
  return db;
}

export function getStudent(db, code) {
  if (typeof code !== 'string') return null;
  const row = db.prepare('SELECT profile FROM students WHERE code = ?').get(code.trim().toUpperCase());
  return row ? JSON.parse(row.profile) : null;
}
