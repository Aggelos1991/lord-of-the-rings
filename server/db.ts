import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'ledger_app',
  password: process.env.DB_PASS || 'L3dg3r_R1ngs_2024!',
  database: process.env.DB_NAME || 'ledger_of_the_rings',
  waitForConnections: true,
  connectionLimit: 10,
});

// === FILE QUERIES ===

export async function getFiles(vendorName: string) {
  const [rows] = await pool.execute(
    'SELECT id, vendor_name, filename, file_size, mime_type, uploaded_at FROM vendor_files WHERE vendor_name = ? ORDER BY uploaded_at DESC',
    [vendorName]
  );
  return rows;
}

export async function addFile(vendorName: string, filename: string, fileBuffer: Buffer, fileSize: number, mimeType: string) {
  const [result]: any = await pool.execute(
    'INSERT INTO vendor_files (vendor_name, filename, file_data, file_size, mime_type) VALUES (?, ?, ?, ?, ?)',
    [vendorName, filename, fileBuffer, fileSize, mimeType]
  );
  return {
    id: result.insertId,
    vendor_name: vendorName,
    filename,
    file_size: fileSize,
    mime_type: mimeType,
    uploaded_at: new Date().toISOString(),
  };
}

export async function getFileData(fileId: number) {
  const [rows]: any = await pool.execute(
    'SELECT filename, file_data, mime_type FROM vendor_files WHERE id = ?',
    [fileId]
  );
  return rows[0] || null;
}

export async function deleteFile(fileId: number) {
  await pool.execute('DELETE FROM vendor_files WHERE id = ?', [fileId]);
}

// === COMMENT QUERIES ===

export async function getComments(vendorName: string) {
  const [rows] = await pool.execute(
    'SELECT id, vendor_name, comment, created_at FROM vendor_comments WHERE vendor_name = ? ORDER BY created_at DESC',
    [vendorName]
  );
  return rows;
}

export async function addComment(vendorName: string, comment: string) {
  const [result]: any = await pool.execute(
    'INSERT INTO vendor_comments (vendor_name, comment) VALUES (?, ?)',
    [vendorName, comment]
  );
  return {
    id: result.insertId,
    vendor_name: vendorName,
    comment,
    created_at: new Date().toISOString(),
  };
}

export async function deleteComment(commentId: number) {
  await pool.execute('DELETE FROM vendor_comments WHERE id = ?', [commentId]);
}

export default pool;
