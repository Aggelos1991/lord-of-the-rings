import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS vendor_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendor_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_files_vendor ON vendor_files(vendor_name);
  CREATE INDEX IF NOT EXISTS idx_comments_vendor ON vendor_comments(vendor_name);
`);

// === FILE QUERIES ===

export function getFiles(vendorName: string) {
  return db.prepare(
    'SELECT id, vendor_name, filename, file_size, mime_type, uploaded_at FROM vendor_files WHERE vendor_name = ? ORDER BY uploaded_at DESC'
  ).all(vendorName);
}

export function addFile(vendorName: string, filename: string, filepath: string, fileSize: number, mimeType: string) {
  const stmt = db.prepare(
    'INSERT INTO vendor_files (vendor_name, filename, filepath, file_size, mime_type) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(vendorName, filename, filepath, fileSize, mimeType);
  return { id: result.lastInsertRowid, vendor_name: vendorName, filename, file_size: fileSize, mime_type: mimeType, uploaded_at: new Date().toISOString() };
}

export function getFilePath(fileId: number) {
  const row = db.prepare('SELECT filepath, filename FROM vendor_files WHERE id = ?').get(fileId) as any;
  return row || null;
}

export function deleteFile(fileId: number) {
  const row = db.prepare('SELECT filepath FROM vendor_files WHERE id = ?').get(fileId) as any;
  db.prepare('DELETE FROM vendor_files WHERE id = ?').run(fileId);
  return row?.filepath || null;
}

// === COMMENT QUERIES ===

export function getComments(vendorName: string) {
  return db.prepare(
    'SELECT id, vendor_name, comment, created_at FROM vendor_comments WHERE vendor_name = ? ORDER BY created_at DESC'
  ).all(vendorName);
}

export function addComment(vendorName: string, comment: string) {
  const stmt = db.prepare(
    'INSERT INTO vendor_comments (vendor_name, comment) VALUES (?, ?)'
  );
  const result = stmt.run(vendorName, comment);
  return { id: result.lastInsertRowid, vendor_name: vendorName, comment, created_at: new Date().toISOString() };
}

export function deleteComment(commentId: number) {
  db.prepare('DELETE FROM vendor_comments WHERE id = ?').run(commentId);
}

export default db;
