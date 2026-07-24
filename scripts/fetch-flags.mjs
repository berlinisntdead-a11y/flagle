// One-time flag download: reads data/countries.json, saves SVGs from
// flagcdn.com into /flags/{id}.svg. Idempotent — existing non-empty files are
// skipped. The shipped app never hits the network.
//   node scripts/fetch-flags.mjs

import { readFile, writeFile, stat } from 'node:fs/promises';

const DATA = new URL('../data/countries.json', import.meta.url);
const FLAGS_DIR = new URL('../flags/', import.meta.url);
const CONCURRENCY = 8;

const countries = JSON.parse(await readFile(DATA, 'utf8'));

async function exists(url) {
  try {
    const s = await stat(url);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function fetchFlag(id, attempt = 1) {
  const res = await fetch(`https://flagcdn.com/${id}.svg`);
  if (!res.ok) {
    if (attempt < 2) return fetchFlag(id, attempt + 1);
    throw new Error(`${id}: HTTP ${res.status}`);
  }
  const svg = await res.text();
  if (!svg.includes('<svg')) throw new Error(`${id}: response is not SVG`);
  await writeFile(new URL(`${id}.svg`, FLAGS_DIR), svg);
}

const queue = [...countries];
const failures = [];
let downloaded = 0;
let skipped = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      if (await exists(new URL(`${c.id}.svg`, FLAGS_DIR))) {
        skipped++;
        continue;
      }
      try {
        await fetchFlag(c.id);
        downloaded++;
      } catch (err) {
        failures.push(String(err.message || err));
      }
    }
  }),
);

console.log(`Flags: ${downloaded} downloaded, ${skipped} already present, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
