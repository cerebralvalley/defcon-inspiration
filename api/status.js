import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
const dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 1024);
const root = dirname(dirname(fileURLToPath(import.meta.url)));

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  let embeddings = null;
  try {
    embeddings = JSON.parse(await readFile(resolve(root, 'data/defcon-all-v1/embeddings.json'), 'utf8')).counts;
  } catch {}

  return res.status(200).json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model,
    dimensions,
    embeddings,
  });
}
