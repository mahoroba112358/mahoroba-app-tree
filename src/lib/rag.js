// src/lib/rag.js
// 完全ローカル RAG 検索ライブラリ
// docs-index/*.json を読み込み、コサイン類似度（埋め込み有時）または部分文字列スコア（無時）で検索

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const INDEX_DIR = path.join(__dirname, '..', '..', 'docs-index');

const ADMIN_ONLY_PREFIX = '宿舎食事_管理者_';

let cache = null;
let embedder = null;
let embedderInitTried = false;

function loadIndex() {
  if (cache) return cache;
  if (!fs.existsSync(INDEX_DIR)) {
    cache = [];
    return cache;
  }
  const files = fs.readdirSync(INDEX_DIR).filter((f) => f.endsWith('.json'));
  cache = files.map((f) => {
    const json = JSON.parse(fs.readFileSync(path.join(INDEX_DIR, f), 'utf8'));
    return { source: f.replace(/\.json$/, '.pdf'), ...json };
  });
  return cache;
}

async function getEmbedder() {
  if (embedderInitTried) return embedder;
  embedderInitTried = true;
  try {
    const tx = await import('@xenova/transformers');
    const pipe = await tx.pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
    embedder = async (text) => {
      const out = await pipe('query: ' + text, { pooling: 'mean', normalize: true });
      return Array.from(out.data);
    };
  } catch (e) {
    console.warn('[rag] 埋め込みモデルが利用できません。テキストマッチで検索します。', e.message);
    embedder = null;
  }
  return embedder;
}

function cosineSim(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function textScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 1;
  const tokens = q.split(/\s+/).filter(Boolean);
  let hits = 0;
  for (const tok of tokens) if (t.includes(tok)) hits++;
  return tokens.length === 0 ? 0 : hits / tokens.length;
}

async function search(query, opts = {}) {
  const { topK = 3, includeAdmin = false } = opts;
  const index = loadIndex();

  const filtered = index.filter((doc) => {
    if (doc.source && doc.source.startsWith(ADMIN_ONLY_PREFIX) && !includeAdmin) return false;
    return true;
  });

  if (filtered.length === 0) return [];

  const embed = await getEmbedder();
  let queryVec = null;
  if (embed) {
    try {
      queryVec = await embed(query);
    } catch {
      queryVec = null;
    }
  }

  const scored = [];
  for (const doc of filtered) {
    for (const chunk of doc.chunks) {
      let score = 0;
      if (queryVec && chunk.embedding) {
        score = cosineSim(queryVec, chunk.embedding);
      } else {
        score = textScore(query, chunk.text);
      }
      if (score > 0) {
        scored.push({
          source: doc.source,
          chunkId: chunk.id,
          score,
          excerpt: chunk.text.slice(0, 240),
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function clearCache() {
  cache = null;
}

module.exports = { search, clearCache };
