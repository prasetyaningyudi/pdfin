'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { apiLimiter } = require('./src/middleware/rateLimit');
const pdfRoutes = require('./src/routes/pdf');
const { PdfError } = require('./src/services/merge');
const { PORT, MAX_FILES, MAX_FILE_MB, MAX_TOTAL_MB, TRUST_PROXY } = require('./src/config');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  next();
});

app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api', apiLimiter);
app.use('/api', pdfRoutes);

app.get('/api/config', (req, res) => {
  res.json({ maxFiles: MAX_FILES, maxFileMb: MAX_FILE_MB, maxTotalMb: MAX_TOTAL_MB });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof PdfError) {
    return res.status(err.status || 422).json({ error: err.message });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Permintaan terlalu besar.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => {
  console.log(`pdfin berjalan di http://localhost:${PORT}`);
});
