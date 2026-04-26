# DEF CON Inspiration

Public DEF CON research idea index with summaries, transcripts, precomputed embeddings, a browser UI, and a local search CLI.

This repo is meant to make the dataset easy to clone, inspect, search, and build on.

Website:

```text
https://defcon-inspiration.cerebralvalley.ai
```

## What Is Included

- `ideas.html`: standalone dashboard UI.
- `api/embed.js`: optional Vercel serverless route for semantic query embeddings.
- `api/status.js`: dataset status route.
- `data/defcon-all-v1/idea-index.json`: project summaries and ideas.
- `data/defcon-all-v1/videos.json`: source video metadata.
- `data/defcon-all-v1/embeddings.json`: precomputed embedding vectors for projects and ideas.
- `data/defcon-all-v1/transcripts/*.txt`: raw transcript text by YouTube video id.
- `src/defcon/search.mjs`: local CLI for exact, fuzzy, and semantic search.

## Dataset

Current corpus:

- 1,481 projects
- 2,962 ideas
- 1,481 transcripts
- 4,443 embedding records

## Local Search

```bash
npm install
npm run search -- --query "dark web autonomous agents" --mode fuzzy --limit 5
npm run search -- --id uFyk5UOyNqI --show transcript --transcript-lines 120
```

Search modes:

```bash
npm run search -- --query "npm malware" --mode exact
npm run search -- --query "npn malwar dependncy" --mode fuzzy
npm run search -- --query "supply chain attacks" --mode semantic
```

Semantic search requires an OpenAI API key:

```bash
cp .env.example .env
# add OPENAI_API_KEY to .env
npm run search -- --query "supply chain attacks" --mode semantic
```

For machine-readable output, use `--json`. If calling through `npm run`, use `--silent` so npm does not print its command banner before the JSON:

```bash
npm run --silent search -- --query "npm malware" --mode fuzzy --limit 3 --json
node src/defcon/search.mjs --id uFyk5UOyNqI --show all --json
```

## CLI From GitHub

You can run the CLI directly from the repo after cloning:

```bash
git clone https://github.com/cerebralvalley/defcon-inspiration.git
cd defcon-inspiration
npm install
npm run search -- --query "onion services" --mode fuzzy
```

You can also install it from a local checkout:

```bash
npm install -g .
defcon-search --query "onion services" --mode fuzzy
defcon-search --id uFyk5UOyNqI --show all
```

The package includes the dataset, so the CLI works offline for exact/fuzzy search after installation. Semantic search still needs `OPENAI_API_KEY` because it embeds the query at search time.

## Data Files

Useful entrypoints:

```text
data/defcon-all-v1/idea-index.json
data/defcon-all-v1/videos.json
data/defcon-all-v1/embeddings.json
data/defcon-all-v1/transcripts/uFyk5UOyNqI.txt
```

Each project in `idea-index.json` includes the source YouTube id/link, talk metadata, a project summary, findings, and two derived ideas with reproducibility scores.

## Website / Vercel

```bash
npm install
npm run build
```

Recommended Vercel settings:

- Framework preset: `Other`
- Build command: `npm run build`
- Output directory: `public`
- Environment variable for semantic web search: `OPENAI_API_KEY`

Production target:

```text
defcon-inspiration.cerebralvalley.ai
```

## Notes

The data is derived from public DEF CON YouTube talk transcripts and metadata. The summaries and ideas are generated analysis, so treat them as a research index and verify important claims against the source transcript/video.
