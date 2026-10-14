'use strict';

const { PdfError } = require('./merge');

function cleanText(text) {
  return text
    .replace(/\u00AD/g, '')
    .replace(/-\n(?=\p{L})/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n');
}

function reconstructLayout(items) {
  if (!items || items.length === 0) return '';
  
  const sorted = items.slice().sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.transform[4] - b.transform[4];
  });
  
  let result = '';
  let lastY = null;
  let lastX = 0;
  
  for (const item of sorted) {
    const y = item.transform[5];
    const x = item.transform[4];
    
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      result += '\n';
      lastX = 0;
    } else if (lastY !== null && x > lastX + 5) {
      const spaces = Math.max(1, Math.round((x - lastX) / 5));
      result += ' '.repeat(spaces);
    }
    
    result += item.str;
    lastY = y;
    lastX = x + (item.width || 0);
  }
  
  return result;
}

async function extractText(buffer, format = 'layout') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new PdfError('File PDF kosong atau tidak valid.', 400);
  }

  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const loadingTask = getDocument({ 
      data: new Uint8Array(buffer), 
      disableWorker: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/legacy/build/'
    });
    
    const pdf = await loadingTask.promise;
    
    const pageSep = format === 'raw' ? ' ' : '\n\n';
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      let pageText = '';
      
      if (format === 'raw') {
        const textContent = await page.getTextContent({ disableCombineTextItems: false });
        pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      } 
      else if (format === 'clean') {
        const textContent = await page.getTextContent({ disableCombineTextItems: false });
        const raw = textContent.items.reduce(
          (acc, item) => acc + item.str + (item.hasEOL ? '\n' : ' '),
          ''
        );
        pageText = cleanText(raw);
      }
      else { // 'layout' (default)
        const textContent = await page.getTextContent({ disableCombineTextItems: true });
        pageText = reconstructLayout(textContent.items);
      }
      
      fullText += pageText + pageSep;
    }
    
    return {
      text: fullText.trim(),
      pages: pdf.numPages,
      info: {},
      metadata: {},
      version: null,
    };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (/password|encrypt|protected/i.test(msg)) {
      throw new PdfError(
        'PDF terproteksi password dan tidak bisa dibaca. Hapus proteksi terlebih dahulu.',
        422
      );
    }
    if (/invalid|corrupt|damaged|structure/i.test(msg)) {
      throw new PdfError('File PDF tidak valid atau rusak.', 400);
    }
    throw new PdfError(`Gagal mengekstrak teks: ${msg}`);
  }
}

module.exports = { extractText };