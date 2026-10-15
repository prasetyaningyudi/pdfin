const fs = require('fs');
const path = require('path');

async function testExtractText(format) {
  const filePath = path.join(__dirname, 'test', 'sample-c.pdf');
  const buffer = fs.readFileSync(filePath);
  
  const boundary = '----TestBoundary123';
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample-c.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const formatPart = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="format"\r\n\r\n${format}\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  
  const body = Buffer.concat([
    Buffer.from(header),
    buffer,
    Buffer.from(formatPart),
    Buffer.from(footer)
  ]);
  
  const port = process.env.PORT || 3100;
  const response = await fetch(`http://127.0.0.1:${port}/api/extract-text`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: body,
  });
  
  console.log(`\n=== Format: ${format} ===`);
  console.log('Status:', response.status);
  
  if (!response.ok) {
    const text = await response.text();
    console.log('Error response:', text);
    return;
  }
  
  const data = await response.json();
  console.log('Format received:', data.format);
  console.log('Text (first 300 chars):', data.text.slice(0, 300));
}

async function main() {
  await testExtractText('layout');
  await testExtractText('clean');
  await testExtractText('raw');
}

main().catch(console.error);