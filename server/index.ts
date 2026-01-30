import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { getFiles, addFile, getFileData, deleteFile, getComments, addComment, deleteComment } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer config — store in memory (we save to MySQL BLOB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ===== FILE ROUTES =====

// List files for a vendor
app.get('/api/vendors/:vendorName/files', async (req, res) => {
  try {
    const files = await getFiles(decodeURIComponent(req.params.vendorName));
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload file for a vendor
app.post('/api/vendors/:vendorName/files', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const vendorName = decodeURIComponent(req.params.vendorName);
    const result = await addFile(
      vendorName,
      req.file.originalname,
      req.file.buffer,
      req.file.size,
      req.file.mimetype
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download file
app.get('/api/vendors/:vendorName/files/:fileId/download', async (req, res) => {
  try {
    const fileInfo = await getFileData(parseInt(req.params.fileId, 10));
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
    res.setHeader('Content-Type', fileInfo.mime_type || 'application/octet-stream');
    res.send(fileInfo.file_data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file
app.delete('/api/vendors/:vendorName/files/:fileId', async (req, res) => {
  try {
    await deleteFile(parseInt(req.params.fileId, 10));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===== COMMENT ROUTES =====

// List comments for a vendor
app.get('/api/vendors/:vendorName/comments', async (req, res) => {
  try {
    const comments = await getComments(decodeURIComponent(req.params.vendorName));
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment for a vendor
app.post('/api/vendors/:vendorName/comments', async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    const vendorName = decodeURIComponent(req.params.vendorName);
    const result = await addComment(vendorName, comment.trim());
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete comment
app.delete('/api/vendors/:vendorName/comments/:commentId', async (req, res) => {
  try {
    await deleteComment(parseInt(req.params.commentId, 10));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n  Vendor API server running on http://localhost:${PORT}`);
  console.log(`  Connected to MySQL database\n`);
});
