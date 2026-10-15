'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const { PdfError, loadPdf } = require('./merge');

const QUALITIES = ['high', 'medium', 'low'];

const GS_PRESETS = {
  high: '/prepress',
  medium: '/ebook',
  low: '/screen',
};

const RASTER_PRESETS = {
  medium: { dpi: 150, quality: 75 },
  low: { dpi: 96, quality: 60 },
};

const STANDARD_FONTS_URL =
  path.join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/';

const GS_TIMEOUT_MS = 120000;

let gsProbe = null;

function findGhostscript() {
  if (!gsProbe) {
    const candidates = process.platform === 'win32' ? ['gswin64c', 'gswin32c'] : ['gs'];
    gsProbe = (async () => {
      for (const bin of candidates) {
        try {
          await new Promise((resolve, reject) => {
            execFile(bin, ['-v'], { timeout: 5000 }, (err) => (err ? reject(err) : resolve()));
          });
          return bin;
        } catch (_) {
          /* coba kandidat berikutnya */
        }
      }
      return false;
    })();
  }
  return gsProbe;
}

function runGhostscript(buffer, bin, gsPreset) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfin-gs-'));
  const inPath = path.join(dir, 'in.pdf');
  const outPath = path.join(dir, 'out.pdf');

  return new Promise((resolve, reject) => {
    fs.writeFile(inPath, buffer, (writeErr) => {
      if (writeErr) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
        return reject(writeErr);
      }
      execFile(
        bin,
        [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.4',
          `-dPDFSETTINGS=${gsPreset}`,
          '-dNOPAUSE',
          '-dBATCH',
          '-dQUIET',
          `-sOutputFile=${outPath}`,
          inPath,
        ],
        { timeout: GS_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
        (err) => {
          let out = null;
          try {
            if (!err && fs.existsSync(outPath)) out = fs.readFileSync(outPath);
          } catch (_) {
            out = null;
          }
          try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
          if (out && out.length > 0) {
            resolve(out);
          } else {
            reject(err || new Error('Ghostscript tidak menghasilkan output.'));
          }
        }
      );
    });
  });
}

async function rasterizePdf(buffer, dpi, jpegQuality) {
  const canvasLib = require('@napi-rs/canvas');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
  });
  const pdf = await loadingTask.promise;

  try {
    const out = await PDFDocument.create();
    const scale = dpi / 72;

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      const w = Math.max(1, Math.ceil(viewport.width));
      const h = Math.max(1, Math.ceil(viewport.height));

      const canvas = canvasLib.createCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const jpeg = canvas.toBuffer('image/jpeg', jpegQuality);
      const image = await out.embedJpg(jpeg);
      const outPage = out.addPage([base.width, base.height]);
      outPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
    }

    return Buffer.from(await out.save({ useObjectStreams: true }));
  } finally {
    try { await loadingTask.destroy(); } catch (_) { /* ignore */ }
  }
}

async function compressPdf(buffer, qualityInput) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new PdfError('File PDF kosong atau tidak valid.', 400);
  }
  const quality = QUALITIES.includes(qualityInput) ? qualityInput : 'medium';
  const originalSize = buffer.length;

  const doc = await loadPdf(buffer);

  let out = null;
  let engine = 'original';

  const gs = await findGhostscript();
  if (gs) {
    try {
      const r = await runGhostscript(buffer, gs, GS_PRESETS[quality]);
      if (r.length > 0 && r.length < originalSize) {
        out = r;
        engine = 'gs';
      }
    } catch (_) {
      /* jatuh ke fallback */
    }
  }

  if (!out && quality === 'high') {
    try {
      const r = Buffer.from(await doc.save({ useObjectStreams: true }));
      if (r.length < originalSize) {
        out = r;
        engine = 'lossless';
      }
    } catch (_) {
      /* jatuh ke file asli */
    }
  }

  if (!out && quality !== 'high') {
    const preset = RASTER_PRESETS[quality];
    try {
      const r = await rasterizePdf(buffer, preset.dpi, preset.quality);
      if (r.length < originalSize) {
        out = r;
        engine = 'raster';
      }
    } catch (_) {
      /* jatuh ke file asli */
    }
  }

  if (!out) {
    out = buffer;
    engine = 'original';
  }

  const compressedSize = out.length;
  const ratio =
    originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : '0';

  return {
    buffer: out,
    originalSize,
    compressedSize,
    ratio: `${ratio}%`,
    engine,
  };
}

module.exports = { compressPdf, QUALITIES };
