import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
const dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 1024);
const queryCache = new Map();
let embeddingsPromise = null;
const root = dirname(dirname(fileURLToPath(import.meta.url)));

function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function dot(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += a[index] * b[index];
  return sum;
}

async function loadEmbeddings() {
  if (!embeddingsPromise) {
    embeddingsPromise = readFile(resolve(root, 'data/defcon-all-v1/embeddings.json'), 'utf8')
      .then((text) => JSON.parse(text));
  }
  return embeddingsPromise;
}

async function embedQuery(query) {
  const key = query.trim().toLowerCase();
  if (queryCache.has(key)) return queryCache.get(key);
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not set');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, input: query, dimensions }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`OpenAI embeddings failed: ${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
    error.statusCode = response.status;
    throw error;
  }

  const json = await response.json();
  const vector = normalizeVector(json.data[0].embedding);
  queryCache.set(key, vector);
  return vector;
}

async function semanticSearch(query, limit) {
  const [embeddings, vector] = await Promise.all([loadEmbeddings(), embedQuery(query)]);
  const scores = new Map();
  for (const record of embeddings.records || []) {
    if (record.projectKind === 'archive') continue;
    const score = dot(vector, record.vector);
    const previous = scores.get(record.projectId);
    if (!previous || score > previous.score) {
      scores.set(record.projectId, {
        projectId: record.projectId,
        score: Number(score.toFixed(6)),
        match: {
          id: record.id,
          kind: record.kind,
          title: record.title,
        },
      });
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return res.status(405).json({ error: 'method not allowed' });
    }

    const query = String(req.body?.query || '').trim();
    const limit = Math.min(Math.max(Number(req.body?.limit || 160), 1), 500);
    if (!query) return res.status(400).json({ error: 'query is required' });
    if (query.length > 2000) return res.status(400).json({ error: 'query is too long' });

    const hits = await semanticSearch(query, limit);
    return res.status(200).json({ model, dimensions, hits });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}
