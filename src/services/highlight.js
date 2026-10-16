'use strict';

const { rgb, BlendMode } = require('pdf-lib');
const { PdfError, loadPdf } = require('./merge');
const { parseColor, clampNum } = require('./decorate');

const MAX_HIGHLIGHTS = 1000;

function validateRects(raw, pageCount) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new PdfError('Daftar area highlight kosong. Sorot teks terlebih dahulu.', 400);
  }
  if (raw.length > MAX_HIGHLIGHTS) {
    throw new PdfError(`Terlalu banyak highlight (maks ${MAX_HIGHLIGHTS}).`, 400);
  }

  return raw.map((r) => {
    if (!r || typeof r !== 'object') {
      throw new PdfError('Format highlight tidak valid.', 400);
    }
    const page = Number(r.page);
    const x = Number(r.x);
    const y = Number(r.y);
    const width = Number(r.w);
    const height = Number(r.h);
    if (!Number.isInteger(page) || page < 0 || page >= pageCount) {
      throw new PdfError('Nomor halaman pada highlight tidak valid.', 400);
    }
    if (![x, y, width, height].every(Number.isFinite)) {
      throw new PdfError('Koordinat highlight tidak valid.', 400);
    }
    if (width <= 0 || height <= 0) {
      throw new PdfError('Ukuran highlight tidak valid.', 400);
    }
    return { page, x, y, width, height };
  });
}

async function highlightRects(buffer, opts) {
  const doc = await loadPdf(buffer);
  const pages = doc.getPages();
  if (pages.length === 0) {
    throw new PdfError('PDF tidak punya halaman.');
  }

  const rects = validateRects(opts.rects, pages.length);
  const opacity = clampNum(opts.opacity, 0.05, 1, 0.4);
  const color = parseColor(opts.color, rgb(1, 1, 0));

  try {
    for (const r of rects) {
      const page = pages[r.page];
      const { width: pw, height: ph } = page.getSize();
      const x = Math.min(Math.max(0, r.x), pw);
      const y = Math.min(Math.max(0, r.y), ph);
      const w = Math.min(r.width, pw - x);
      const h = Math.min(r.height, ph - y);
      if (w <= 0 || h <= 0) continue;
      page.drawRectangle({ x, y, width: w, height: h, color, opacity, blendMode: BlendMode.Multiply });
    }
    return Buffer.from(await doc.save());
  } catch (err) {
    if (err instanceof PdfError) throw err;
    const msg = String(err && err.message ? err.message : err);
    throw new PdfError(`Gagal menambahkan highlight: ${msg}`);
  }
}

module.exports = { highlightRects, MAX_HIGHLIGHTS };
