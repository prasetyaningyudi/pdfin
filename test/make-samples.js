'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function makePdf(filename, pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([400, 300]);
    page.drawText(`${filename} - Page ${i} of ${pages}`, {
      x: 50, y: 150, size: 18, font, color: rgb(0, 0, 0.7),
    });
  }
  const bytes = await doc.save();
  const out = path.join(__dirname, filename);
  fs.writeFileSync(out, bytes);
  console.log(`created ${filename}: ${pages} pages, ${bytes.length} bytes`);
}

(async () => {
  await makePdf('sample-a.pdf', 3);
  await makePdf('sample-b.pdf', 2);
  await makePdf('sample-c.pdf', 5);
})();
