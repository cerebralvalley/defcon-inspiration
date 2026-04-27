#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '..');
const DEFAULT_DIR = resolve(ROOT_DIR, 'data/defcon-all-v1');

function parseArgs(argv) {
  const opts = {
    dir: DEFAULT_DIR,
    query: '',
    words: 45,
    limit: 40,
    perVideo: 3,
    regex: false,
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
    else if (arg === '--query' || arg === '-q') opts.query = next();
    else if (arg === '--words') opts.words = Number(next());
    else if (arg === '--limit' || arg === '-n') opts.limit = Number(next());
    else if (arg === '--per-video') opts.perVideo = Number(next());
    else if (arg === '--regex') opts.regex = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (!opts.query) opts.query = arg;
    else opts.query += ` ${arg}`;
  }

  if (!opts.query && !opts.help) throw new Error('Missing query');
  for (const key of ['words', 'limit', 'perVideo']) {
    if (!Number.isInteger(opts[key]) || opts[key] < 1) throw new Error(`--${key} must be a positive integer`);
  }
  return opts;
}

function printHelp() {
  console.log(`Usage:
  npm run snippets -- "google home"
  npm run snippets -- --query "google home|google homes" --regex --words 60
  npm run snippets -- --query "smart speaker" --limit 20 --per-video 2

Options:
  --query, -q TEXT      Text or regex pattern to search across transcripts.
  --regex              Treat query as a JavaScript regular expression.
  --words N            Context words before and after each hit. Default: 45.
  --limit, -n N        Maximum snippets. Default: 40.
  --per-video N        Maximum snippets per video. Default: 3.
  --dir PATH           Data directory. Default: ${DEFAULT_DIR}
  --json               Print JSON.
`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function wordWindow(text, start, end, wordCount) {
  const before = text.slice(0, start).match(/\S+/g) || [];
  const match = text.slice(start, end);
  const after = text.slice(end).match(/\S+/g) || [];
  const prefix = before.slice(-wordCount).join(' ');
  const suffix = after.slice(0, wordCount).join(' ');
  return normalize(`${prefix} [[${match}]] ${suffix}`);
}

function makeRegex(query, isRegex) {
  return new RegExp(isRegex ? query : escapeRegExp(query), 'giu');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const videosPath = resolve(opts.dir, 'videos.json');
  const transcriptsDir = resolve(opts.dir, 'transcripts');
  const videos = JSON.parse(await readFile(videosPath, 'utf8'));
  const byId = new Map(videos.map((video) => [video.id, video]));
  const files = (await readdir(transcriptsDir)).filter((file) => file.endsWith('.txt')).sort();
  const regex = makeRegex(opts.query, opts.regex);
  const hits = [];

  for (const file of files) {
    const id = basename(file, '.txt');
    const video = byId.get(id) || { id, title: id, url: `https://www.youtube.com/watch?v=${id}` };
    const text = normalize(await readFile(resolve(transcriptsDir, file), 'utf8'));
    let perVideo = 0;
    regex.lastIndex = 0;
    for (let match = regex.exec(text); match; match = regex.exec(text)) {
      hits.push({
        id,
        title: video.title,
        url: video.url,
        playlistTitle: video.playlistTitle || '',
        viewCount: video.viewCount || 0,
        match: match[0],
        snippet: wordWindow(text, match.index, match.index + match[0].length, opts.words),
      });
      perVideo += 1;
      if (perVideo >= opts.perVideo || hits.length >= opts.limit) break;
      if (match[0].length === 0) regex.lastIndex += 1;
    }
    if (hits.length >= opts.limit) break;
  }

  if (opts.json) {
    console.log(JSON.stringify(hits, null, 2));
    return;
  }

  if (!hits.length) {
    console.log(`No transcript snippets found for: ${opts.query}`);
    return;
  }

  for (const [index, hit] of hits.entries()) {
    console.log(`\n${index + 1}. ${hit.title}`);
    console.log(`   ${hit.url}`);
    if (hit.playlistTitle) console.log(`   ${hit.playlistTitle} | views: ${hit.viewCount.toLocaleString()}`);
    console.log(`   ${hit.snippet}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
