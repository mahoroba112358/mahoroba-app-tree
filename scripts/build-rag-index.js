// scripts/build-rag-index.js
// docs/pdf/*.pdf からテキスト抽出 → チャンク化 → 埋め込みベクトル生成
// 出力: docs-index/<pdf名>.json
// 完全ローカル。外部 API 不使用。

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const pdfParse = require('pdf-parse');

const PDF_DIR = path.join(__dirname, '..', 'docs', 'pdf');
const INDEX_DIR = path.join(__dirname, '..', 'docs-index');

const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 80;

function chunkText(text) {
  const cleaned = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const paragraphs = cleaned.split(/\n\n+/);

  const chunks = [];
  let buf = '';
  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > CHUNK_SIZE) {
      if (buf) chunks.push(buf);
      buf = p.length > CHUNK_SIZE ? p.slice(0, CHUNK_SIZE) : p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf) chunks.push(buf);

  if (CHUNK_OVERLAP > 0 && chunks.length > 1) {
    const overlapped = [];
    for (let i = 0; i < chunks.length; i++) {
      const tail = i > 0 ? chunks[i - 1].slice(-CHUNK_OVERLAP) : '';
      overlapped.push(tail + chunks[i]);
    }
    return overlapped;
  }
  return chunks;
}

async function buildEmbedder() {
  try {
    const tx = await import('@xenova/transformers');
    tx.env.allowRemoteModels = true;
    tx.env.localModelPath = path.join(__dirname, '..', 'models');
    const pipe = await tx.pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
    return async (text) => {
      const out = await pipe('passage: ' + text, { pooling: 'mean', normalize: true });
      return Array.from(out.data);
    };
  } catch (e) {
    console.warn('[build-rag-index] @xenova/transformers が読み込めませんでした。テキスト検索のみのインデックスを生成します。');
    console.warn('  詳細:', e.message);
    return null;
  }
}

async function main() {
  if (!fs.existsSync(PDF_DIR)) {
    console.error(`PDF ディレクトリが存在しません: ${PDF_DIR}`);
    console.error('先に `npm run convert-docs` を実行してください。');
    process.exit(1);
  }

  if (!fs.existsSync(INDEX_DIR)) fs.mkdirSync(INDEX_DIR, { recursive: true });

  const pdfFiles = fs.readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    console.log('インデックス対象の PDF がありません。');
    return;
  }

  const embed = await buildEmbedder();

  for (const file of pdfFiles) {
    const full = path.join(PDF_DIR, file);
    console.log(`[index] ${file}`);

    const buf = fs.readFileSync(full);
    const parsed = await pdfParse(buf);
    const chunks = chunkText(parsed.text);

    const records = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const rec = { id: i, text: chunk, length: chunk.length };
      if (embed) {
        rec.embedding = await embed(chunk);
      }
      records.push(rec);
    }

    const out = {
      file,
      pages: parsed.numpages,
      chunkCount: records.length,
      embeddingModel: embed ? 'Xenova/multilingual-e5-small' : null,
      generatedAt: new Date().toISOString(),
      chunks: records,
    };

    const outPath = path.join(INDEX_DIR, file.replace(/\.pdf$/i, '.json'));
    fs.writeFileSync(outPath, JSON.stringify(out));
    console.log(`  -> ${outPath}  (${records.length} chunks)`);
  }

  console.log('インデックス生成完了。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
