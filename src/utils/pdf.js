const path = require('path');
const { HttpError } = require('./errors');

function hasPdfHeader(buffer) {
  const head = buffer.subarray(0, 1024).toString('latin1');
  return head.includes('%PDF-');
}

function sanitizeFilename(name, fallback) {
  const cleaned = String(name || '')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  if (!cleaned) return fallback;
  return cleaned;
}

function pdfName(originalname) {
  const base = path.basename(String(originalname || 'file.pdf'));
  const name = sanitizeFilename(base.replace(/\.pdf$/i, ''), 'file');
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

function toFriendlyPdfError(err, filename) {
  const name = err && err.name ? err.name : '';
  const message = err && err.message ? String(err.message) : '';

  if (name === 'EncryptedPDFError' || /encrypt|password/i.test(message)) {
    return new HttpError(
      422,
      `PDF "${filename}" terproteksi password. Buka proteksinya terlebih dahulu lalu coba lagi.`
    );
  }
  if (/not a valid pdf|invalid pdf|failed to parse|malformed|corrupt|xref|missing header/i.test(message)) {
    return new HttpError(422, `File "${filename}" bukan PDF valid atau file-nya rusak.`);
  }
  return new HttpError(422, `Gagal memproses file "${filename}".`);
}

module.exports = { hasPdfHeader, sanitizeFilename, pdfName, toFriendlyPdfError };
