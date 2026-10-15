'use strict';

const multer = require('multer');
const { MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_FILES } = require('../config');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES,
    fields: 20,
    parts: MAX_FILES + 10,
  },
});

function isPdfBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 5) return false;
  const head = buf.subarray(0, 1024).toString('latin1');
  return head.includes('%PDF-');
}

function validatePdfFiles(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) {
    return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
  }
  for (const f of files) {
    if (!isPdfBuffer(f.buffer)) {
      return res
        .status(400)
        .json({ error: `File "${f.originalname}" bukan PDF yang valid.` });
    }
  }
  const total = files.reduce((sum, f) => sum + f.buffer.length, 0);
  if (total > MAX_TOTAL_BYTES) {
    return res.status(413).json({
      error: `Total ukuran file melebihi batas ${Math.floor(MAX_TOTAL_BYTES / (1024 * 1024))} MB.`,
    });
  }
  next();
}

function handleMulterError(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `Ukuran file melebihi batas ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB per file.`,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: `Maksimal ${MAX_FILES} file per permintaan.`,
      });
    }
    return res.status(400).json({ error: 'Upload gagal: ' + err.message });
  }
  return next(err);
}

module.exports = { upload, validatePdfFiles, handleMulterError };
