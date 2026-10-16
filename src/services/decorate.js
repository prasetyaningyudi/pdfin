'use strict';

const { StandardFonts, rgb, degrees } = require('pdf-lib');
const { PdfError, loadPdf } = require('./merge');

const WATERMARK_STYLES = ['diagonal', 'center', 'tiled'];
const NUMBER_POSITIONS = [
  'bottom-center',
  'bottom-right',
  'bottom-left',
  'top-center',
  'top-right',
  'top-left',
];
const MAX_WATERMARK_CHARS = 200;
const MAX_TEMPLATE_CHARS = 80;
const MAX_TILE_LOOPS = 4000;

function parseColor(hex, fallback) {
  if (typeof hex !== 'string') return fallback;
  const m = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return fallback;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function clampNum(value, min, max, fallback) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pageGeom(page) {
  const { width: pw, height: ph } = page.getSize();
  const raw = page.getRotation().angle % 360;
  const norm = raw < 0 ? raw + 360 : raw;
  const angle = [0, 90, 180, 270].includes(norm) ? norm : 0;
  const swapped = angle === 90 || angle === 270;
  return {
    pw,
    ph,
    angle,
    vw: swapped ? ph : pw,
    vh: swapped ? pw : ph,
  };
}

function visualToPage(g, vx, vy) {
  switch (g.angle) {
    case 90:
      return { x: g.pw - vy, y: vx };
    case 180:
      return { x: g.pw - vx, y: g.ph - vy };
    case 270:
      return { x: vy, y: g.ph - vx };
    default:
      return { x: vx, y: vy };
  }
}

async function addWatermark(buffer, opts) {
  const text = String(opts.text || '').trim();
  if (!text) {
    throw new PdfError('Teks watermark kosong.', 400);
  }
  if (text.length > MAX_WATERMARK_CHARS) {
    throw new PdfError(
      `Teks watermark terlalu panjang (maks ${MAX_WATERMARK_CHARS} karakter).`,
      400
    );
  }

  const style = WATERMARK_STYLES.includes(opts.style) ? opts.style : 'diagonal';
  const opacity = clampNum(opts.opacity, 0.05, 1, 0.25);
  const fontSizeOpt = clampNum(opts.fontSize, 0, 200, 0);
  const color = parseColor(opts.color, rgb(0.6, 0.6, 0.6));

  const doc = await loadPdf(buffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  if (pages.length === 0) {
    throw new PdfError('PDF tidak punya halaman.');
  }

  try {
    for (const page of pages) {
      const g = pageGeom(page);
      const size = fontSizeOpt || Math.max(18, Math.floor(Math.min(g.vw, g.vh) / 8));
      const textWidth = font.widthOfTextAtSize(text, size);

      if (style === 'center') {
        const p = visualToPage(g, (g.vw - textWidth) / 2, g.vh / 2 - size / 2);
        const draw = { x: p.x, y: p.y, size, font, color, opacity };
        if (g.angle) draw.rotate = degrees(g.angle);
        page.drawText(text, draw);
      } else if (style === 'diagonal') {
        const p = visualToPage(g, g.vw / 2 - textWidth / 2, g.vh / 2);
        page.drawText(text, {
          x: p.x,
          y: p.y,
          size,
          font,
          color,
          opacity,
          rotate: degrees(45 + g.angle),
        });
      } else {
        const stepX = textWidth + size * 2;
        const stepY = size * 5;
        if (stepX > 0 && stepY > 0) {
          let row = 0;
          for (let vy = stepY; vy < g.vh && row * (Math.ceil(g.vw / stepX) + 1) < MAX_TILE_LOOPS; vy += stepY) {
            const offset = row % 2 === 0 ? 0 : stepX / 2;
            for (let vx = -stepX; vx < g.vw + stepX; vx += stepX) {
              const p = visualToPage(g, vx + offset, vy);
              page.drawText(text, {
                x: p.x,
                y: p.y,
                size,
                font,
                color,
                opacity: Math.min(opacity, 0.35),
                rotate: degrees(30 + g.angle),
              });
            }
            row += 1;
          }
        }
      }
    }
    return Buffer.from(await doc.save());
  } catch (err) {
    if (err instanceof PdfError) throw err;
    const msg = String(err && err.message ? err.message : err);
    if (/WinAnsi|not supported|encode/i.test(msg)) {
      throw new PdfError(
        'Teks mengandung karakter yang tidak didukung. Gunakan karakter Latin/ASCII saja.'
      );
    }
    throw new PdfError(`Gagal menambahkan watermark: ${msg}`);
  }
}

async function addPageNumbers(buffer, opts) {
  const template =
    typeof opts.format === 'string' && opts.format.trim()
      ? opts.format.trim()
      : '{n}';
  if (template.length > MAX_TEMPLATE_CHARS) {
    throw new PdfError(
      `Format nomor halaman terlalu panjang (maks ${MAX_TEMPLATE_CHARS} karakter).`,
      400
    );
  }

  const position = NUMBER_POSITIONS.includes(opts.position)
    ? opts.position
    : 'bottom-center';
  const fontSize = clampNum(opts.fontSize, 6, 72, 10);
  const color = parseColor(opts.color, rgb(0.1, 0.1, 0.1));
  const margin = 20;

  const doc = await loadPdf(buffer);
  const pages = doc.getPages();
  if (pages.length === 0) {
    throw new PdfError('PDF tidak punya halaman.');
  }
  const total = pages.length;
  const font = await doc.embedFont(StandardFonts.Helvetica);

  try {
    pages.forEach((page, i) => {
      const text = template
        .replace(/\{n\}/g, String(i + 1))
        .replace(/\{total\}/g, String(total));
      const w = font.widthOfTextAtSize(text, fontSize);
      const g = pageGeom(page);

      let vx;
      let vy;
      switch (position) {
        case 'bottom-left':
          vx = margin;
          vy = margin;
          break;
        case 'bottom-right':
          vx = g.vw - w - margin;
          vy = margin;
          break;
        case 'top-center':
          vx = (g.vw - w) / 2;
          vy = g.vh - margin - fontSize;
          break;
        case 'top-left':
          vx = margin;
          vy = g.vh - margin - fontSize;
          break;
        case 'top-right':
          vx = g.vw - w - margin;
          vy = g.vh - margin - fontSize;
          break;
        default:
          vx = (g.vw - w) / 2;
          vy = margin;
      }

      const p = visualToPage(g, vx, vy);
      const draw = { x: p.x, y: p.y, size: fontSize, font, color };
      if (g.angle) draw.rotate = degrees(g.angle);
      page.drawText(text, draw);
    });
    return Buffer.from(await doc.save());
  } catch (err) {
    if (err instanceof PdfError) throw err;
    const msg = String(err && err.message ? err.message : err);
    if (/WinAnsi|not supported|encode/i.test(msg)) {
      throw new PdfError(
        'Teks mengandung karakter yang tidak didukung. Gunakan karakter Latin/ASCII saja.'
      );
    }
    throw new PdfError(`Gagal menambahkan nomor halaman: ${msg}`);
  }
}

module.exports = {
  addWatermark,
  addPageNumbers,
  WATERMARK_STYLES,
  NUMBER_POSITIONS,
  parseColor,
  clampNum,
};
