import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
const dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 1024);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  let embeddings = null;
  try {
    embeddings = JSON.parse(await readFile(resolve(process.cwd(), 'data/defcon-all-v1/embeddings.json'), 'utf8')).counts;
  } catch {}

  return res.status(200).json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model,
    dimensions,
    embeddings,
  });
}
