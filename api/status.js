import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  let counts = null;
  try {
    const index = JSON.parse(await readFile(resolve(root, 'data/defcon-all-v1/idea-index.json'), 'utf8'));
    counts = {
      projects: index.projects?.length || 0,
      ideas: index.projects?.reduce((sum, project) => sum + (project.ideas?.length || 0), 0) || 0,
    };
  } catch {}

  return res.status(200).json({
    ok: true,
    counts,
  });
}
