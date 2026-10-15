'use strict';

const express = require('express');
const AdmZip = require('adm-zip');
const { upload, validatePdfFiles, handleMulterError } = require('../middleware/upload');
const { mergePdfs, PdfError } = require('../services/merge');
const { splitByRanges, splitPerPage, getPageSize } = require('../services/split');
const { compressPdf } = require('../services/compress');
const { extractText } = require('../services/extractText');
const { organizePages } = require('../services/organize');
const { addWatermark, addPageNumbers } = require('../services/decorate');

const router = express.Router();

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

function sendZip(res, outputs) {
  const zip = new AdmZip();
  for (const out of outputs) {
    zip.addFile(out.name, out.buffer);
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="hasil-split.zip"');
  res.send(zip.toBuffer());
}

router.post(
  '/merge',
  upload.array('files'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const buffers = req.files.map((f) => f.buffer);
      const merged = await mergePdfs(buffers);
      sendPdf(res, merged, 'hasil-merge.pdf');
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/pagecount',
  upload.single('file'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const pages = await getPageSize(req.file.buffer);
      res.json({ pages, name: req.file.originalname });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/split',
  upload.single('file'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const mode = req.body.mode === 'pages' ? 'pages' : 'ranges';
      const buffer = req.file.buffer;

      if (mode === 'pages') {
        const { outputs } = await splitPerPage(buffer);
        if (outputs.length === 1) {
          sendPdf(res, outputs[0].buffer, outputs[0].name);
        } else {
          sendZip(res, outputs);
        }
        return;
      }

      const { outputs } = await splitByRanges(buffer, req.body.ranges);
      if (outputs.length === 1) {
        sendPdf(res, outputs[0].buffer, outputs[0].name);
      } else {
        sendZip(res, outputs);
      }
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/compress',
  upload.single('file'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const result = await compressPdf(req.file.buffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="hasil-kompres.pdf"`);
      res.setHeader('X-Original-Size', result.originalSize.toString());
      res.setHeader('X-Compressed-Size', result.compressedSize.toString());
      res.setHeader('X-Compress-Ratio', result.ratio);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/extract-text',
  upload.single('file'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const format = req.body.format === 'clean' || req.body.format === 'raw'
        ? req.body.format
        : 'layout';
      const result = await extractText(req.file.buffer, format);
      res.json({
        text: result.text,
        pages: result.pages,
        info: result.info,
        metadata: result.metadata,
        version: result.version,
        name: req.file.originalname,
        format,
      });
    } catch (err) {
      next(err);
    }
  }
);

function parseJsonField(raw, field, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new PdfError(`Field "${field}" bukan JSON yang valid.`, 400);
  }
}

router.post(
  '/organize',
  upload.single('file'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const order = parseJsonField(req.body.order, 'order', null);
      const rotations = parseJsonField(req.body.rotations, 'rotations', {});
      const buffer = await organizePages(req.file.buffer, { order, rotations });
      sendPdf(res, buffer, 'hasil-atur-halaman.pdf');
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/watermark',
  upload.single('file'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const buffer = await addWatermark(req.file.buffer, {
        text: req.body.text,
        style: req.body.style,
        opacity: req.body.opacity,
        fontSize: req.body.fontSize,
        color: req.body.color,
      });
      sendPdf(res, buffer, 'hasil-watermark.pdf');
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/page-numbers',
  upload.single('file'),
  handleMulterError,
  validatePdfFiles,
  async (req, res, next) => {
    try {
      const buffer = await addPageNumbers(req.file.buffer, {
        format: req.body.format,
        position: req.body.position,
        fontSize: req.body.fontSize,
        color: req.body.color,
      });
      sendPdf(res, buffer, 'hasil-nomor-halaman.pdf');
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
