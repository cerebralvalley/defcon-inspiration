import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "public");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(join(root, "ideas.html"), join(out, "ideas.html"));
await cp(join(root, "ideas.html"), join(out, "index.html"));
await cp(join(root, "data"), join(out, "data"), { recursive: true });
await rm(join(out, "data", "defcon-all-v1", "embeddings.json"), { force: true });

console.log("built static assets into public/");
