#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_DIR = resolve(ROOT_DIR, 'data/defcon-all-v1');
const DEFAULT_MODEL = 'text-embedding-3-large';
const DEFAULT_DIMENSIONS = 1024;

loadEnv({ path: resolve(ROOT_DIR, '.env') });

function parseArgs(argv) {
  const opts = {
    dir: DEFAULT_DIR,
    mode: 'fuzzy',
    query: '',
    id: '',
    limit: 10,
    show: 'ideas',
    transcriptLines: 80,
    includeArchive: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === '--dir') opts.dir = next();
    else if (arg === '--mode') opts.mode = next();
    else if (arg === '--query' || arg === '-q') opts.query = next();
    else if (arg === '--id') opts.id = next();
    else if (arg === '--limit' || arg === '-n') opts.limit = Number(next());
    else if (arg === '--show') opts.show = next();
    else if (arg === '--transcript-lines') opts.transcriptLines = Number(next());
    else if (arg === '--include-archive' || arg === '--all-uploads') opts.includeArchive = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (!opts.query) opts.query = arg;
    else opts.query += ` ${arg}`;
  }

  if (!['semantic', 'exact', 'fuzzy'].includes(opts.mode)) {
    throw new Error('--mode must be semantic, exact, or fuzzy');
  }
  if (!['ideas', 'summary', 'method', 'findings', 'transcript', 'all'].includes(opts.show)) {
    throw new Error('--show must be ideas, summary, method, findings, transcript, or all');
  }
  if (!Number.isInteger(opts.limit) || opts.limit < 1) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(opts.transcriptLines) || opts.transcriptLines < 1) {
    throw new Error('--transcript-lines must be a positive integer');
  }
  return opts;
}

function printHelp() {
  console.log(`Usage:
  npm run defcon:search -- --query "npm malware dependency"
  npm run defcon:search -- --mode fuzzy --query "npn malwar dependncy"
  npm run defcon:search -- --id emhocCFs9N4 --show all
  npm run defcon:search -- --id emhocCFs9N4 --show transcript --transcript-lines 120

Options:
  --query, -q TEXT        Search query.
  --mode MODE            fuzzy, exact, or semantic. Default: fuzzy. Semantic requires your own OPENAI_API_KEY.
  --limit, -n N          Number of search hits. Default: 10.
  --id VIDEO_ID          Show one project by YouTube id.
  --show SECTION         ideas, summary, method, findings, transcript, or all. Default: ideas.
  --transcript-lines N   Lines to print for transcript views. Default: 80.
  --include-archive      Include interviews, previews, ceremonies, contest updates, and other non-project uploads.
  --dir PATH             Data directory. Default: ${DEFAULT_DIR}
  --json                 Print JSON instead of formatted text.
`);
}

async function loadData(dir, needEmbeddings) {
  const indexPath = resolve(dir, 'idea-index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const projects = index.projects || [];
  projects.forEach((project) => {
    project.searchText = searchBlob(project);
  });

  let embeddings = null;
  if (needEmbeddings) {
    const embeddingsPath = resolve(dir, 'embeddings.json');
    embeddings = JSON.parse(await readFile(embeddingsPath, 'utf8'));
  }
  return { index, projects, embeddings };
}

function searchBlob(project) {
  return [
    project.title,
    project.videoTitle,
    project.summary,
    project.presenter_project,
    project.general_description,
    project.how_they_did_it,
    project.what_they_found,
    project.why_it_was_good,
    ...(project.ideas || []).map((idea) => `${idea.title} ${idea.idea} ${idea.why}`),
  ].join(' ').toLowerCase();
}

function exactSearch(projects, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return projects
    .filter((project) => {
      const tokens = project.exactTokens || (project.exactTokens = new Set(project.searchText.match(/[a-z0-9_./:-]+/g) || []));
      return terms.every((term) => tokens.has(term));
    })
    .map((project) => ({ project, score: 1 }));
}

function fuzzySearch(projects, query) {
  return projects
    .map((project) => ({ project, score: fuzzyScore(project, query) }))
    .filter((hit) => hit.score >= 0.5)
    .sort((a, b) => b.score - a.score);
}

function fuzzyScore(project, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const tokens = project.searchTokens || (project.searchTokens = [...new Set(project.searchText.match(/[a-z0-9_./:-]+/g) || [])].slice(0, 900));
  let total = 0;
  for (const term of terms) {
    if (project.searchText.includes(term)) {
      total += 1;
      continue;
    }
    let best = 0;
    for (const token of tokens) {
      const score = fuzzyTermScore(term, token);
      if (score > best) best = score;
      if (best >= 0.92) break;
    }
    if (best < 0.48) return 0;
    total += best;
  }
  return total / terms.length;
}

function fuzzyTermScore(term, token) {
  if (!term || !token) return 0;
  if (token.includes(term)) return Math.min(1, 0.75 + term.length / Math.max(token.length, 1));
  if (term.includes(token) && token.length > 2) return Math.min(0.82, token.length / term.length);
  if (term.length < 3 || token.length < 3) return 0;
  const distance = levenshtein(term, token);
  const maxLen = Math.max(term.length, token.length);
  const editScore = 1 - distance / maxLen;
  const subseqScore = isSubsequence(term, token) ? Math.min(0.72, term.length / token.length) : 0;
  return Math.max(editScore, subseqScore);
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3 && !a.includes(b) && !b.includes(a)) return Math.max(a.length, b.length);
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j], row[j - 1]) + 1;
      prev = old;
    }
  }
  return row[b.length];
}

function isSubsequence(shorter, longer) {
  let index = 0;
  for (const char of longer) if (char === shorter[index]) index += 1;
  return index === shorter.length;
}

async function semanticSearch(projects, embeddings, query) {
  const queryVector = await embedQuery(query, embeddings);
  const byProject = new Map(projects.map((project) => [project.id, project]));
  const scores = new Map();

  for (const record of embeddings.records || []) {
    const score = dot(queryVector, record.vector);
    const previous = scores.get(record.projectId);
    if (!previous || score > previous.score) {
      scores.set(record.projectId, { project: byProject.get(record.projectId), score, match: record });
    }
  }

  return [...scores.values()]
    .filter((hit) => hit.project)
    .sort((a, b) => b.score - a.score);
}

async function embedQuery(query, embeddings) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for semantic search');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: embeddings.model || DEFAULT_MODEL,
      input: query,
      dimensions: embeddings.dimensions || DEFAULT_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  return normalize(payload.data[0].embedding);
}

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function dot(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += a[index] * b[index];
  return sum;
}

function formatSearchResults(hits, opts) {
  const lines = [];
  hits.slice(0, opts.limit).forEach((hit, index) => {
    const project = hit.project;
    lines.push(`${index + 1}. ${project.title} (${project.id}) score ${hit.score.toFixed(3)}`);
    lines.push(`   ${project.videoTitle}`);
    if (hit.match) lines.push(`   best match: ${hit.match.kind} - ${hit.match.title}`);
    for (const idea of project.ideas || []) {
      lines.push(`   - ${idea.reproducibility_score}/10 ${idea.idea_type}: ${idea.title} — ${idea.idea}`);
    }
    lines.push(`   ${project.url}`);
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

async function formatProject(project, opts) {
  if (opts.json) return JSON.stringify(project, null, 2);
  const sections = [];
  sections.push(`${project.title} (${project.id})`);
  sections.push(project.videoTitle);
  sections.push(project.url);

  const show = opts.show;
  if (show === 'summary' || show === 'all') {
    sections.push(`\nSummary:\n${project.summary}`);
  }
  if (show === 'method' || show === 'all') {
    sections.push(`\nMethod:\n${project.how_they_did_it}`);
  }
  if (show === 'findings' || show === 'all') {
    sections.push(`\nFindings:\n${project.what_they_found}`);
  }
  if (show === 'ideas' || show === 'all') {
    sections.push(`\nIdeas:\n${(project.ideas || []).map((idea) => `- ${idea.reproducibility_score}/10 ${idea.idea_type}: ${idea.title}\n  ${idea.idea}\n  ${idea.why}`).join('\n')}`);
  }
  if (show === 'transcript' || show === 'all') {
    sections.push(`\nTranscript:\n${await readTranscript(project, opts)}`);
  }
  return sections.join('\n');
}

async function readTranscript(project, opts) {
  const path = resolve(opts.dir, 'transcripts', `${project.id}.txt`);
  if (!existsSync(path)) return '(missing transcript)';
  const text = await readFile(path, 'utf8');
  return wrapText(text, 100).slice(0, opts.transcriptLines).join('\n');
}

function wrapText(text, width) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (line.length + word.length + 1 <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const needEmbeddings = opts.mode === 'semantic' && !opts.id;
  const loaded = await loadData(opts.dir, needEmbeddings);
  const projects = opts.includeArchive
    ? loaded.projects
    : loaded.projects.filter((project) => project.project_kind !== 'archive');
  const embeddings = loaded.embeddings;

  if (opts.id) {
    const project = projects.find((item) => item.id === opts.id);
    if (!project) throw new Error(`No project found for id: ${opts.id}`);
    console.log(await formatProject(project, opts));
    return;
  }

  if (!opts.query) throw new Error('--query is required unless --id is provided');

  const hits = opts.mode === 'semantic'
    ? await semanticSearch(projects, embeddings, opts.query)
    : opts.mode === 'fuzzy'
      ? fuzzySearch(projects, opts.query)
      : exactSearch(projects, opts.query);

  if (opts.json) {
    console.log(JSON.stringify(hits.slice(0, opts.limit).map(({ project, score, match }) => ({ score, match, project })), null, 2));
  } else {
    console.log(formatSearchResults(hits, opts));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
