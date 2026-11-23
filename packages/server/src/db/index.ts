import Database from 'better-sqlite3';
import { config } from '../config.js';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const db = new Database(config.dbPath);

  // 启用 WAL 模式提高并发与性能，配置快速同步
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // 初始化数据表
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      icon TEXT,
      color TEXT,
      order_num INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL,
      snippet TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(is_deleted, is_archived, is_pinned);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      note_id TEXT,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      hash TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      category TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      duration REAL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_hash ON attachments(hash);
    CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      nickname TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 增量字段平滑迁移 (添加 user_id)
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN user_id TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE folders ADD COLUMN user_id TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE attachments ADD COLUMN user_id TEXT`);
  } catch {}

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id)`);
  } catch {}

  dbInstance = db;
  return dbInstance;
}
