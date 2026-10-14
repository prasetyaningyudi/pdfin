'use strict';

const rateLimit = require('express-rate-limit');
const { RATE_WINDOW_MS, RATE_MAX_API } = require('../config');

const apiLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: RATE_MAX_API,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.' },
});

module.exports = { apiLimiter };
