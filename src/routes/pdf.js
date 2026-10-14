'use strict';

const express = require('express');
const AdmZip = require('adm-zip');
const { upload, validatePdfFiles, handleMulterError } = require('../middleware/upload');
const { mergePdfs } = require('../services/merge');
const { splitByRanges, splitPerPage, getPageSize } = require('../services/split');
const { compressPdf } = require('../services/compress');
const { extractText } = require('../services/extractText');

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

module.exports = router;
