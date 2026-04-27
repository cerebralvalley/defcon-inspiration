# DEF CON Inspiration

Searchable DEF CON project ideas, summaries, source videos, transcripts, and a small local CLI.

Website:

```text
https://defcon-inspiration.cerebralvalley.ai
```

This is meant to be easy to hand to a hacker or an AI coding agent. Clone it, search the dataset, open transcripts, and use the results as inspiration for new security projects.

## Quick Start

```bash
git clone https://github.com/cerebralvalley/defcon-inspiration.git
cd defcon-inspiration
npm install
npm run search -- --query "onion services agents" --limit 5
```

Show one project with transcript:

```bash
npm run search -- --id uFyk5UOyNqI --show all --transcript-lines 120
```

Machine-readable output for agents:

```bash
npm run --silent search -- --query "npm malware supply chain" --json --limit 5
```

Grep raw transcripts with local context:

```bash
npm run snippets -- --query "google homes?" --regex --sentences 2
```

## What You Get

- `ideas.html`: standalone browser UI.
- `src/defcon/search.mjs`: local search CLI.
- `scripts/grep-snippets.mjs`: raw transcript grep with surrounding context.
- `data/defcon-all-v1/idea-index.json`: summaries, findings, and derived ideas.
- `data/defcon-all-v1/videos.json`: YouTube metadata.
- `data/defcon-all-v1/transcripts/*.txt`: raw transcripts by YouTube video id.
- `data/defcon-all-v1/embeddings.json`: optional vectors for local semantic CLI search.

Current corpus:

- 2,175 projects
- 4,350 ideas
- 2,195 transcripts
- 6,525 embedding records

## Search Modes

Default fuzzy search works offline:

```bash
npm run search -- --query "npn malwar dependncy"
```

Exact token search:

```bash
npm run search -- --query "npm malware" --mode exact
```

Optional semantic search:

```bash
cp .env.example .env
# Add your own OPENAI_API_KEY to .env
npm run search -- --query "supply chain attacks" --mode semantic
```

Semantic search is CLI-only. The website does not call OpenAI and does not ship the embeddings file in the static build.

## Useful CLI Commands

```bash
# Search project ideas
npm run search -- --query "AIS spoofing" --limit 10

# Include archived/non-project uploads too
npm run search -- --query "policy cyber war" --include-archive

# Print only methodology
npm run search -- --id XNtS0wQIyjY --show method

# Print only findings
npm run search -- --id XNtS0wQIyjY --show findings

# Print transcript text
npm run search -- --id XNtS0wQIyjY --show transcript --transcript-lines 200

# Grep all raw transcripts with context
npm run snippets -- --query "google homes?" --regex --sentences 2
```

Install globally from a local checkout:

```bash
npm install -g .
defcon-search --query "container security"
defcon-search --id uFyk5UOyNqI --show all
defcon-snippets --query "google homes?" --regex --sentences 2
```

## AI Agent Prompt

Use this with Cursor, Codex, Claude, or another coding agent:

```text
Use the DEF CON Inspiration CLI in this repo.
Search for projects related to: <your topic>.
Run fuzzy search first, inspect the top results, then open the most relevant transcripts.
Return 5 buildable hackathon ideas with source video ids, what the presenter actually built, what they found, and how we could adapt it.
Use --json when parsing results programmatically.
```

Good agent commands:

```bash
npm run --silent search -- --query "sensor fusion RF drone" --json --limit 8
npm run --silent search -- --id <VIDEO_ID> --show all --json
```

## Website / Vercel

Build the static site:

```bash
npm run build
```

The build writes `public/` and removes `public/data/defcon-all-v1/embeddings.json` so the deployed website has no OpenAI dependency.

Recommended Vercel settings:

- Framework preset: `Other`
- Build command: `npm run build`
- Output directory: `public`
- No `OPENAI_API_KEY` is needed for the website.

## Notes

The data is derived from public DEF CON YouTube talks. The summaries and ideas are generated analysis, so verify important claims against the linked video or transcript before relying on them.
