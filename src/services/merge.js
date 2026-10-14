'use strict';

const { PDFDocument } = require('pdf-lib');

class PdfError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
    this.name = 'PdfError';
  }
}

function friendlyPdfError(err, action) {
  const msg = String(err && err.message ? err.message : err);
  if (err && err.name === 'EncryptedPDFError') {
    return new PdfError(
      'PDF terproteksi password dan tidak bisa diproses. Hapus proteksi terlebih dahulu.'
    );
  }
  if (/encrypt/i.test(msg)) {
    return new PdfError(
      'PDF terproteksi password dan tidak bisa diproses. Hapus proteksi terlebih dahulu.'
    );
  }
  if (/could not parse/i.test(msg) || /no pages found/i.test(msg) || /invalid/i.test(msg)) {
    return new PdfError(`File tidak valid atau rusak dan tidak bisa di-${action}.`);
  }
  return new PdfError(`Gagal memproses PDF: ${msg}`);
}

async function loadPdf(buffer) {
  try {
    return await PDFDocument.load(buffer);
  } catch (err) {
    throw friendlyPdfError(err, 'dibaca');
  }
}

async function mergePdfs(buffers) {
  if (!Array.isArray(buffers) || buffers.length < 2) {
    throw new PdfError('Minimal 2 file PDF untuk digabung.', 400);
  }
  const merged = await PDFDocument.create();
  for (const buffer of buffers) {
    const src = await loadPdf(buffer);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  merged.setTitle('Merged Document');
  try {
    return Buffer.from(await merged.save());
  } catch (err) {
    throw friendlyPdfError(err, 'digabung');
  }
}

module.exports = { mergePdfs, loadPdf, PdfError };
