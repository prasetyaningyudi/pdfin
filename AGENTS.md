# pdfin � Agent Guide

## Project Overview
PDF merge/split web app. Express 5 + pdf-lib. Server renders a static SPA from `public/`.

## Run
```bash
npm start          # runs node server.js on PORT (default 3100)
```

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3100 | HTTP port |
| MAX_FILES | 20 | Max files per request |
| MAX_FILE_MB | 50 | Max size per file (MB) |
| MAX_TOTAL_MB | 100 | Max total upload size (MB) |
| RATE_WINDOW_MS | 60000 | Rate limit window (ms) |
| RATE_MAX_API | 60 | Max requests per window |
| RATE_MAX_OP | 10 | (Unused in code) |
| TRUST_PROXY | 0 | Express trust proxy setting |

## API Endpoints
- `POST /api/merge` ? multipart `files[]` (2+ PDFs) ? merged PDF
- `POST /api/split` ? multipart `file` + `mode` (ranges|pages) + optional `ranges` ? PDF or ZIP
- `POST /api/pagecount` ? multipart `file` ? `{ pages, name }`
- `POST /api/organize` ? multipart `file` + `order` (JSON array) + `rotations` (JSON object) ? reorder/hapus/rotasi halaman
- `POST /api/watermark` ? multipart `file` + `text` + `style` (diagonal|center|tiled) + optional `opacity`/`fontSize`/`color` ? PDF
- `POST /api/page-numbers` ? multipart `file` + optional `format` (`{n}`/`{total}` template) + `position`/`fontSize`/`color` ? PDF
- `POST /api/compress` ? multipart `file` + optional `quality` (high|medium|low, default medium) ? PDF + headers `X-Compress-Ratio` / `X-Compress-Engine` (gs|lossless|raster|original)
- `POST /api/extract-text` ? multipart `file` + optional `format` (layout|clean|raw) ? JSON teks
- `POST /api/highlight` ? multipart `file` + `rects` (JSON array `{page,x,y,w,h}` dalam poin PDF, maks 1000) + optional `color` (hex) / `opacity` ? PDF berhighlight
- `GET /api/config` ? `{ maxFiles, maxFileMb, maxTotalMb }`

## Key Files
- `server.js` � entrypoint, middleware, error handling
- `src/config.js` � all env-driven config
- `src/routes/pdf.js` � API route handlers
- `src/services/merge.js` � merge logic, `PdfError` class
- `src/services/split.js` � split by ranges / per page
- `src/services/organize.js` — reorder/hapus/rotasi halaman
- `src/services/decorate.js` — watermark & nomor halaman
- `src/services/compress.js` — hybrid: Ghostscript → fallback lossless (high) / raster (medium|low)
- `src/services/extractText.js` — teks extraction via pdfjs (server-side)
- `src/services/highlight.js` — gambar rect highlight (pdf-lib), validasi rect
- `src/utils/` — `errors.js` (HttpError, legacy), `pdf.js`, `async.js` (sebagian tidak dipakai route utama)
- `src/middleware/upload.js` � multer config, PDF validation, size limits
- `src/middleware/rateLimit.js` � express-rate-limit wrapper
- `public/` � static SPA (index.html, app.js, style.css)

## Conventions
- `'use strict'` in all source files
- CommonJS `require`/`module.exports`
- Errors: `PdfError` (422/400) for known issues, 500 for unknown
- Multer uses memory storage; files in `req.files` / `req.file` as Buffers
- PDF validation checks `%PDF-` magic bytes in first 1KB
- No test framework, no lint, no typecheck configured

## Gotchas
- Express 5 (beta) � middleware signatures may differ from v4
- Rate limit only on `/api`; static files unrestricted
- `RATE_MAX_OP` is defined but not used
- Sample PDFs in `test/` generated via `node test/make-samples.js` (requires pdf-lib)
- Compress pakai Ghostscript jika ada di PATH (Dockerfile: `apk add ghostscript`); tanpa gs → high = lossless repack, medium/low = raster via `@napi-rs/canvas`
- `pdfjs-dist` dipakai server-side (extractText, compress) dan client-side: route statis `/vendor/pdfjs` (legacy/build). CSS text layer disalin dari `pdf_viewer.css` ke `style.css` dengan scope `.hl-page .textLayer` — jangan link `pdf_viewer.css` global (membawa `color-scheme: light dark` yang menggelapkan input/select seluruh app)
- CSP menyertakan `style-src-attr 'unsafe-inline'` — wajib untuk inline style span text layer pdfjs
- Fitur Sorot Teks: rect dihitung di browser (seleksi cursor / cari kata via text layer), server hanya menggambar; viewer membatasi 200 halaman, cap 1000 highlight
- No CI, no build step � just `node server.js`
