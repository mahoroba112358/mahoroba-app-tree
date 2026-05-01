// src/routes/ai.js
// 完全ローカル RAG 検索エンドポイント。外部 API 呼出は一切なし。

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const { search } = require('../lib/rag');

const router = express.Router();

const ragLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_RAG_PER_MIN || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/search',
  ragLimiter,
  body('query').isString().isLength({ min: 1, max: 200 }),
  body('topK').optional().isInt({ min: 1, max: 10 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'invalid_input' });

    const isAdmin = !!(req.session && req.session.adminAuth);
    const { query, topK } = req.body;

    try {
      const results = await search(query, { topK: topK || 3, includeAdmin: isAdmin });
      res.json({ ok: true, results });
    } catch (e) {
      console.error('[ai/search]', e);
      res.status(500).json({ ok: false, error: 'rag_error' });
    }
  }
);

module.exports = router;
