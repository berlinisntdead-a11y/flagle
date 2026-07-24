// Sanity checks for data/countries.json. Collects every failure, prints all,
// exits non-zero if any. Run after build-data.mjs and fetch-flags.mjs:
//   node scripts/verify-data.mjs

import { readFile, stat } from 'node:fs/promises';
import { normalise } from '../js/normalise.js';

const DATA = new URL('../data/countries.json', import.meta.url);
const FLAGS_DIR = new URL('../flags/', import.meta.url);

const countries = JSON.parse(await readFile(DATA, 'utf8'));
const failures = [];
const fail = (msg) => failures.push(msg);

// --- global shape ---
// 193 UN members + Vatican + Palestine, minus Israel (excluded by owner's decision)
if (countries.length !== 194) fail(`Expected 194 entries, got ${countries.length}`);

const ids = new Set();
for (const c of countries) {
  if (ids.has(c.id)) fail(`Duplicate id: ${c.id}`);
  ids.add(c.id);
}

for (const bad of ['xk', 'tw', 'eh', 'il']) {
  if (ids.has(bad)) fail(`${bad} present but should be excluded`);
}

// --- per-entry invariants ---
const tiers = { easy: 0, medium: 0, hard: 0 };
let longest = { capital: '', len: 0 };

for (const c of countries) {
  const tag = `${c.name} (${c.id})`;

  if (!Array.isArray(c.acceptedAnswers) || c.acceptedAnswers.length === 0)
    fail(`${tag}: acceptedAnswers must be a non-empty array`);
  else if (c.acceptedAnswers[0] !== c.capital)
    fail(`${tag}: acceptedAnswers[0] "${c.acceptedAnswers[0]}" !== capital "${c.capital}"`);

  if (!Array.isArray(c.hints) || c.hints.length !== 3)
    fail(`${tag}: must have exactly 3 hints, has ${c.hints?.length}`);
  else {
    for (const h of c.hints) {
      if (typeof h !== 'string' || !h.trim()) fail(`${tag}: empty hint`);
      else {
        for (const answer of c.acceptedAnswers) {
          if (normalise(h).includes(normalise(answer)))
            fail(`${tag}: hint "${h}" gives away answer "${answer}"`);
        }
      }
    }
  }

  if (!['easy', 'medium', 'hard'].includes(c.tier)) fail(`${tag}: bad tier "${c.tier}"`);
  else tiers[c.tier]++;

  if (typeof c.lat !== 'number' || c.lat < -90 || c.lat > 90) fail(`${tag}: bad lat ${c.lat}`);
  if (typeof c.lng !== 'number' || c.lng < -180 || c.lng > 180) fail(`${tag}: bad lng ${c.lng}`);

  if (c.note !== null && (typeof c.note !== 'string' || !c.note.trim()))
    fail(`${tag}: note must be null or a non-empty string`);

  try {
    const s = await stat(new URL(`${c.id}.svg`, FLAGS_DIR));
    if (s.size === 0) fail(`${tag}: flags/${c.id}.svg is empty`);
  } catch {
    fail(`${tag}: flags/${c.id}.svg missing`);
  }

  if (c.capital.length > longest.len) longest = { capital: c.capital, len: c.capital.length };
}

for (const [tier, n] of Object.entries(tiers)) {
  if (n < 40) fail(`Tier "${tier}" has only ${n} countries, need >= 40`);
}

// --- curated spot checks: multi-capitals, moves, transliterations ---
const byId = Object.fromEntries(countries.map((c) => [c.id, c]));
const expect = (id, capital, mustAccept, mustNote = true) => {
  const c = byId[id];
  if (!c) return fail(`Missing expected country: ${id}`);
  if (c.capital !== capital) fail(`${id}: capital "${c.capital}", expected "${capital}"`);
  for (const a of mustAccept) {
    if (!c.acceptedAnswers.includes(a)) fail(`${id}: must accept "${a}"`);
  }
  if (mustNote && !c.note) fail(`${id}: needs an explanatory note`);
};

expect('za', 'Pretoria', ['Pretoria', 'Cape Town', 'Bloemfontein']);
expect('bo', 'Sucre', ['Sucre', 'La Paz']);
expect('nl', 'Amsterdam', ['Amsterdam', 'The Hague']);
expect('lk', 'Sri Jayawardenepura Kotte', ['Sri Jayawardenepura Kotte', 'Colombo']);
expect('sz', 'Mbabane', ['Mbabane', 'Lobamba']);
expect('kz', 'Astana', ['Astana', 'Nur-Sultan']);
expect('bi', 'Gitega', ['Gitega'], false);
expect('mm', 'Naypyidaw', ['Naypyidaw']);
expect('id', 'Jakarta', ['Jakarta', 'Nusantara']);
expect('ci', 'Yamoussoukro', ['Yamoussoukro', 'Abidjan']);
expect('bj', 'Porto-Novo', ['Porto-Novo', 'Cotonou']);
expect('tz', 'Dodoma', ['Dodoma', 'Dar es Salaam']);
expect('gq', 'Malabo', ['Malabo', 'Ciudad de la Paz']);
expect('pw', 'Ngerulmud', ['Ngerulmud']);
expect('nr', 'Yaren', ['Yaren']);
expect('fm', 'Palikir', ['Palikir']);
expect('ps', 'Jerusalem', ['Jerusalem', 'East Jerusalem', 'Ramallah']);
expect('ua', 'Kyiv', ['Kyiv', 'Kiev'], false);
expect('cn', 'Beijing', ['Beijing', 'Peking'], false);

// near-freebies must be tier easy (deliberate call — see build-data.mjs)
for (const id of ['mx', 'pa', 'gt', 'kw', 'dj', 'lu', 'mc', 'sg', 'va', 'sm', 'ad', 'br']) {
  if (byId[id] && byId[id].tier !== 'easy') fail(`${id}: capital ≈ country name, must be tier easy`);
}

// Burundi: Gitega is the political capital — make sure the data caught up
if (byId['bi'] && byId['bi'].capital !== 'Gitega') fail(`bi: capital must be Gitega (moved 2019)`);

// --- report ---
if (failures.length) {
  console.error(`VERIFY FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`OK: ${countries.length} countries, tiers ${tiers.easy}/${tiers.medium}/${tiers.hard} (easy/medium/hard)`);
console.log(`Longest capital: "${longest.capital}" (${longest.len} chars)`);
