const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
const dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 1024);
const cache = new Map();

function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

async function embedQuery(query) {
  const key = query.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
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
    body: JSON.stringify({
      model,
      input: query,
      dimensions,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`OpenAI embeddings failed: ${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
    error.statusCode = response.status;
    throw error;
  }

  const json = await response.json();
  const vector = normalizeVector(json.data[0].embedding);
  cache.set(key, vector);
  return vector;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return res.status(405).json({ error: 'method not allowed' });
    }

    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ error: 'query is required' });
    const vector = await embedQuery(query);
    return res.status(200).json({ model, dimensions, vector });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}
