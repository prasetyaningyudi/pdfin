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
      const { width, height } = page.getSize();
      const size = fontSizeOpt || Math.max(18, Math.floor(Math.min(width, height) / 8));
      const textWidth = font.widthOfTextAtSize(text, size);

      if (style === 'center') {
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: height / 2 - size / 2,
          size,
          font,
          color,
          opacity,
        });
      } else if (style === 'diagonal') {
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size,
          font,
          color,
          opacity,
          rotate: degrees(45),
        });
      } else {
        const stepX = textWidth + size * 2;
        const stepY = size * 5;
        if (stepX > 0 && stepY > 0) {
          let row = 0;
          for (let y = stepY; y < height && row * (Math.ceil(width / stepX) + 1) < MAX_TILE_LOOPS; y += stepY) {
            const offset = row % 2 === 0 ? 0 : stepX / 2;
            for (let x = -stepX; x < width + stepX; x += stepX) {
              page.drawText(text, {
                x: x + offset,
                y,
                size,
                font,
                color,
                opacity: Math.min(opacity, 0.35),
                rotate: degrees(30),
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
      const { width, height } = page.getSize();

      let x;
      let y;
      switch (position) {
        case 'bottom-left':
          x = margin;
          y = margin;
          break;
        case 'bottom-right':
          x = width - w - margin;
          y = margin;
          break;
        case 'top-center':
          x = (width - w) / 2;
          y = height - margin - fontSize;
          break;
        case 'top-left':
          x = margin;
          y = height - margin - fontSize;
          break;
        case 'top-right':
          x = width - w - margin;
          y = height - margin - fontSize;
          break;
        default:
          x = (width - w) / 2;
          y = margin;
      }

      page.drawText(text, { x, y, size: fontSize, font, color });
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

module.exports = { addWatermark, addPageNumbers, WATERMARK_STYLES, NUMBER_POSITIONS };
