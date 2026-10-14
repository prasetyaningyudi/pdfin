const fs = require('fs');
const path = require('path');

async function test() {
  const filePath = path.join(__dirname, 'test', 'sample-c.pdf');
  const buffer = fs.readFileSync(filePath);
  
  const boundary = '----TestBoundary123';
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample-c.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const formatPart = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="format"\r\n\r\nlayout\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  
  const body = Buffer.concat([
    Buffer.from(header),
    buffer,
    Buffer.from(formatPart),
    Buffer.from(footer)
  ]);
  
  const response = await fetch('http://127.0.0.1:3001/api/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: body,
  });
  
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Format received:', data.format);
  console.log('Text:', data.text.slice(0, 200));
}

test().catch(console.error);