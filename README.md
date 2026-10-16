# pdfin

Aplikasi web **self-hosted** untuk mengelola PDF: gabung, pecah, atur halaman, watermark, kompres, ekstrak teks, dan sorot teks — langsung di browser, file tidak pernah dikirim ke layanan pihak ketiga.

## Fitur

| Fitur | Deskripsi |
|---|---|
| **Gabung PDF** | Gabungkan 2+ file PDF menjadi satu |
| **Pecah PDF** | Pecah berdasarkan rentang halaman (`1-3,5`) atau per halaman → ZIP |
| **Atur halaman** | Urutkan, hapus, dan rotasi halaman dengan preview |
| **Watermark** | Teks diagonal / center / tiled, opacity & ukuran font bisa diatur |
| **Nomor halaman** | Posisi (bawah/tengah/atas, kiri/tengah/kanan), format `{n}`/`{total}` |
| **Kompres PDF** | Kualitas `high`/`medium`/`low` — Ghostscript bila tersedia, fallback lossless/raster |
| **Ekstrak teks** | Mode `layout`/`clean`/`raw` (pdfjs server-side) |
| **Sorot teks** | Sorot lewat kursor atau cari kata di viewer, undo per aksi, warna & opasitas bebas |
| **Hitung halaman** | Validasi jumlah halaman sebelum operasi lain |

## Menjalankan

### Lokal

```bash
npm install
npm start          # buka http://localhost:3100
```

### Docker

```bash
docker compose up -d
```

Image sudah menyertakan **Ghostscript** (jalur kompresi terbaik). Port default: `3100`.

## Environment Variables

| Variabel | Default | Deskripsi |
|---|---|---|
| `PORT` | 3100 | Port HTTP |
| `MAX_FILES` | 20 | Maks file per request |
| `MAX_FILE_MB` | 50 | Maks ukuran per file (MB) |
| `MAX_TOTAL_MB` | 100 | Maks total upload (MB) |
| `RATE_WINDOW_MS` | 60000 | Jendela rate limit (ms) |
| `RATE_MAX_API` | 60 | Maks request per jendela |
| `TRUST_PROXY` | 0 | Express trust proxy |

## API

Semua endpoint menerima **multipart/form-data** dan mengembalikan file PDF kecuali dinyatakan lain.

| Method | Endpoint | Parameter |
|---|---|---|
| POST | `/api/merge` | `files[]` — 2+ PDF → gabungan |
| POST | `/api/split` | `file` + `mode` (`ranges`\|`pages`) + `ranges` opsional → PDF atau ZIP |
| POST | `/api/pagecount` | `file` → `{ pages, name }` |
| POST | `/api/organize` | `file` + `order` (JSON array) + `rotations` (JSON object) |
| POST | `/api/watermark` | `file` + `text` + `style` (`diagonal`\|`center`\|`tiled`) + `opacity`/`fontSize`/`color` opsional |
| POST | `/api/page-numbers` | `file` + `format`/`position`/`fontSize`/`color` opsional |
| POST | `/api/compress` | `file` + `quality` (`high`\|`medium`\|`low`) → header `X-Compress-Ratio`, `X-Compress-Engine` |
| POST | `/api/extract-text` | `file` + `format` (`layout`\|`clean`\|`raw`) → JSON teks |
| POST | `/api/highlight` | `file` + `rects` (JSON `[{page,x,y,w,h}]`, maks 1000) + `color`/`opacity` opsional |
| GET | `/api/config` | → `{ maxFiles, maxFileMb, maxTotalMb }` |

Contoh:

```bash
curl -F "files[]=@a.pdf" -F "files[]=@b.pdf" http://localhost:3100/api/merge -o merged.pdf
```

## Tech Stack

- **Express 5** — server & routing
- **pdf-lib** — operasi PDF (merge/split/dekorasi/highlight, murni JS)
- **pdfjs-dist** — render preview & ekstrak teks
- **multer + helmet + express-rate-limit** — upload, keamanan header/CSP, rate limit
- SPA statis di `public/` — **tanpa build step**, tanpa framework

## Catatan

- File diproses **di memori server** — batas gabungan per request adalah `MAX_TOTAL_MB` (default 100 MB)
- Rate limit hanya berlaku untuk path `/api`
- Kompresi `medium`/`low` tanpa Ghostscript dijalankan lewat raster (`@napi-rs/canvas`) sehingga teks bisa berubah jadi gambar; `high` tetap lossless
- Tidak ada test framework/CI — verifikasi manual lewat UI dan `node --check`

## Lisensi

MIT
