'use strict';

const { PDFDocument } = require('pdf-lib');
const { PdfError, loadPdf } = require('./merge');

const MAX_PAGES = 5000;

function parseRanges(input, pageCount) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new PdfError(
      'Format rentang kosong. Contoh: 1-3,5,7-9',
      400
    );
  }
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new PdfError('Format rentang tidak valid. Contoh: 1-3,5,7-9', 400);
  }

  const ranges = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) {
      throw new PdfError(
        `Rentang "${part}" tidak valid. Gunakan format contoh: 1-3,5,7-9`,
        400
      );
    }
    let start = parseInt(m[1], 10);
    let end = m[2] !== undefined ? parseInt(m[2], 10) : start;
    if (start < 1 || end < 1) {
      throw new PdfError('Nomor halaman mulai dari 1.', 400);
    }
    if (start > end) {
      [start, end] = [end, start];
    }
    if (end > pageCount) {
      throw new PdfError(
        `Halaman ${end} tidak ada. PDF ini punya ${pageCount} halaman.`,
        400
      );
    }
    ranges.push([start, end]);
  }
  return ranges;
}

function rangeLabel(start, end) {
  return start === end ? `${start}` : `${start}-${end}`;
}

async function extractPages(srcDoc, indices, outDoc) {
  const pages = await outDoc.copyPages(srcDoc, indices);
  for (const page of pages) outDoc.addPage(page);
}

async function splitByRanges(buffer, rangesInput) {
  const srcDoc = await loadPdf(buffer);
  const pageCount = srcDoc.getPageCount();
  if (pageCount === 0) {
    throw new PdfError('PDF tidak punya halaman.');
  }
  const ranges = parseRanges(rangesInput, pageCount);

  const outputs = [];
  for (const [start, end] of ranges) {
    const outDoc = await PDFDocument.create();
    const indices = [];
    for (let p = start - 1; p <= end - 1; p += 1) indices.push(p);
    await extractPages(srcDoc, indices, outDoc);
    outputs.push({
      name: `halaman-${rangeLabel(start, end)}.pdf`,
      buffer: Buffer.from(await outDoc.save()),
    });
  }
  return { outputs, pageCount };
}

async function splitPerPage(buffer) {
  const srcDoc = await loadPdf(buffer);
  const pageCount = srcDoc.getPageCount();
  if (pageCount === 0) {
    throw new PdfError('PDF tidak punya halaman.');
  }
  if (pageCount > MAX_PAGES) {
    throw new PdfError(
      `PDF terlalu banyak halaman (${pageCount}). Maksimal ${MAX_PAGES} halaman.`,
      400
    );
  }

  const outputs = [];
  for (let i = 0; i < pageCount; i += 1) {
    const outDoc = await PDFDocument.create();
    await extractPages(srcDoc, [i], outDoc);
    const n = String(i + 1).padStart(String(pageCount).length, '0');
    outputs.push({
      name: `halaman-${n}.pdf`,
      buffer: Buffer.from(await outDoc.save()),
    });
  }
  return { outputs, pageCount };
}

async function getPageSize(buffer) {
  const srcDoc = await loadPdf(buffer);
  return srcDoc.getPageCount();
}

module.exports = { splitByRanges, splitPerPage, getPageSize, parseRanges };
