import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getFiles, addFile, getFilePath, deleteFile, getComments, addComment, deleteComment } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// ===== FILE ROUTES =====

// List files for a vendor
app.get('/api/vendors/:vendorName/files', (req, res) => {
  try {
    const files = getFiles(decodeURIComponent(req.params.vendorName));
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload file for a vendor
app.post('/api/vendors/:vendorName/files', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const vendorName = decodeURIComponent(req.params.vendorName);
    const result = addFile(
      vendorName,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download file
app.get('/api/vendors/:vendorName/files/:fileId/download', (req, res) => {
  try {
    const fileInfo = getFilePath(parseInt(req.params.fileId, 10));
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }
    if (!fs.existsSync(fileInfo.filepath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    res.download(fileInfo.filepath, fileInfo.filename);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file
app.delete('/api/vendors/:vendorName/files/:fileId', (req, res) => {
  try {
    const filepath = deleteFile(parseInt(req.params.fileId, 10));
    // Clean up file from disk
    if (filepath && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===== COMMENT ROUTES =====

// List comments for a vendor
app.get('/api/vendors/:vendorName/comments', (req, res) => {
  try {
    const comments = getComments(decodeURIComponent(req.params.vendorName));
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment for a vendor
app.post('/api/vendors/:vendorName/comments', (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    const vendorName = decodeURIComponent(req.params.vendorName);
    const result = addComment(vendorName, comment.trim());
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete comment
app.delete('/api/vendors/:vendorName/comments/:commentId', (req, res) => {
  try {
    deleteComment(parseInt(req.params.commentId, 10));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n  Vendor API server running on http://localhost:${PORT}`);
  console.log(`  Uploads directory: ${UPLOADS_DIR}\n`);
});
