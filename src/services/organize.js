'use strict';

const { PDFDocument, degrees } = require('pdf-lib');
const { PdfError, loadPdf } = require('./merge');

const VALID_ROTATIONS = [0, 90, 180, 270];
const MAX_PAGES = 5000;

async function organizePages(buffer, { order, rotations }) {
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

  if (!Array.isArray(order) || order.length === 0) {
    throw new PdfError('Daftar halaman kosong. Pilih minimal satu halaman.', 400);
  }
  if (order.length > MAX_PAGES) {
    throw new PdfError(
      `Jumlah halaman terlalu banyak (${order.length}). Maksimal ${MAX_PAGES} halaman.`,
      400
    );
  }
  for (const n of order) {
    if (!Number.isInteger(n) || n < 1 || n > pageCount) {
      throw new PdfError(
        `Nomor halaman "${n}" tidak valid. PDF ini punya ${pageCount} halaman.`,
        400
      );
    }
  }

  const rotMap = rotations && typeof rotations === 'object' ? rotations : {};
  for (const key of Object.keys(rotMap)) {
    const n = parseInt(key, 10);
    if (!Number.isInteger(n) || n < 1 || n > pageCount) {
      throw new PdfError(`Nomor halaman "${key}" tidak valid untuk rotasi.`, 400);
    }
    const deg = rotMap[key];
    if (!VALID_ROTATIONS.includes(deg)) {
      throw new PdfError(
        `Sudut rotasi "${deg}" tidak valid. Gunakan 0, 90, 180, atau 270.`,
        400
      );
    }
  }

  const outDoc = await PDFDocument.create();
  const copied = await outDoc.copyPages(srcDoc, order.map((n) => n - 1));
  for (let i = 0; i < copied.length; i += 1) {
    const page = copied[i];
    const extra = rotMap[order[i]] || 0;
    if (extra) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + extra) % 360));
    }
    outDoc.addPage(page);
  }

  try {
    return Buffer.from(await outDoc.save());
  } catch (err) {
    throw new PdfError(`Gagal menyimpan hasil: ${err.message}`);
  }
}

module.exports = { organizePages };
