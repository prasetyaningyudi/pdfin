'use strict';

const { PDFDocument } = require('pdf-lib');
const { PdfError } = require('./merge');

async function compressPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new PdfError('File PDF kosong atau tidak valid.', 400);
  }
  const originalSize = buffer.length;
  const doc = await PDFDocument.load(buffer);
  const compressed = Buffer.from(await doc.save({ useObjectStreams: true }));
  const compressedSize = compressed.length;
  const ratio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : '0';

  return {
    buffer: compressed,
    originalSize,
    compressedSize,
    ratio: `${ratio}%`,
  };
}

module.exports = { compressPdf };