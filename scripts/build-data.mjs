// One-time data prep: builds data/countries.json from the restcountries.com API
// plus a hand-curated overrides table. Run from anywhere:
//   node scripts/build-data.mjs
// Network is used HERE ONLY — the shipped app never touches it.

import { writeFile } from 'node:fs/promises';

const OUT = new URL('../data/countries.json', import.meta.url);

// The restcountries.com API now requires an account + API key, so we read the
// same v3.1 dataset straight from the project's open-source repo instead.
const SOURCE =
  'https://gitlab.com/restcountries/restcountries/-/raw/master/src/main/resources/countriesV3.1.json';

// UN members + observers we deliberately include. GW is a source-data
// bug: Guinea-Bissau has unMember=false there but joined the UN in 1974.
const OBSERVERS = ['VA', 'PS', 'GW'];
// Excluded by explicit decision (owner's call, 2026-07-24): Israel.
const EXCLUDED = ['IL'];
// Deliberately excluded (contested recognition): Kosovo (XK), Taiwan (TW),
// Western Sahara (EH). See project notes.

// Hand-curated corrections: multi-capital states, recent moves/renames,
// transliterations, political subtleties. `capital` is the DISPLAY form and
// always becomes acceptedAnswers[0].
const OVERRIDES = {
  za: {
    capital: 'Pretoria',
    accepted: ['Pretoria', 'Cape Town', 'Bloemfontein'],
    note: 'South Africa has three capitals: Pretoria (executive), Cape Town (legislative) and Bloemfontein (judicial).',
  },
  bo: {
    capital: 'Sucre',
    accepted: ['Sucre', 'La Paz'],
    note: 'Sucre is the constitutional capital; La Paz is the seat of government.',
  },
  nl: {
    capital: 'Amsterdam',
    accepted: ['Amsterdam', 'The Hague', 'Den Haag'],
    note: 'Amsterdam is the constitutional capital; The Hague is the seat of government.',
  },
  lk: {
    capital: 'Sri Jayawardenepura Kotte',
    accepted: ['Sri Jayawardenepura Kotte', 'Kotte', 'Colombo'],
    note: 'Sri Jayawardenepura Kotte is the legislative capital; Colombo is the executive and commercial centre.',
  },
  sz: {
    capital: 'Mbabane',
    accepted: ['Mbabane', 'Lobamba'],
    note: 'Mbabane is the administrative capital; Lobamba is the royal and legislative capital.',
  },
  ci: {
    capital: 'Yamoussoukro',
    accepted: ['Yamoussoukro', 'Abidjan'],
    note: 'Yamoussoukro is the official capital; Abidjan is the de facto seat of government.',
  },
  bj: {
    capital: 'Porto-Novo',
    accepted: ['Porto-Novo', 'Cotonou'],
    note: 'Porto-Novo is the official capital; Cotonou is the seat of government.',
  },
  tz: {
    capital: 'Dodoma',
    accepted: ['Dodoma', 'Dar es Salaam'],
    note: 'Dodoma is the official capital since the government completed its move from Dar es Salaam.',
  },
  mm: {
    capital: 'Naypyidaw',
    accepted: ['Naypyidaw', 'Nay Pyi Taw', 'Naypyitaw'],
    note: 'Naypyidaw replaced Yangon as capital in 2006.',
  },
  kz: {
    capital: 'Astana',
    accepted: ['Astana', 'Nur-Sultan'],
    note: 'Called Nur-Sultan from 2019 to 2022, then renamed back to Astana.',
  },
  id: {
    capital: 'Jakarta',
    accepted: ['Jakarta', 'Nusantara'],
    note: 'Jakarta remains the capital; a phased move to Nusantara is planned around 2028.',
  },
  eg: {
    capital: 'Cairo',
    accepted: ['Cairo'],
    note: 'Government functions are moving to a purpose-built New Capital east of Cairo.',
  },
  gq: {
    capital: 'Malabo',
    accepted: ['Malabo', 'Ciudad de la Paz'],
    note: 'A January 2026 decree designates Ciudad de la Paz as the new capital; the move from Malabo is under way.',
  },
  ua: { capital: 'Kyiv', accepted: ['Kyiv', 'Kiev'] },
  cn: { capital: 'Beijing', accepted: ['Beijing', 'Peking'] },
  us: { capital: 'Washington, D.C.', accepted: ['Washington, D.C.', 'Washington DC', 'Washington'] },
  ch: { capital: 'Bern', accepted: ['Bern', 'Berne'] },
  in: { capital: 'New Delhi', accepted: ['New Delhi', 'Delhi'] },
  cl: {
    capital: 'Santiago',
    accepted: ['Santiago', 'Valparaíso', 'Valparaiso'],
    note: 'Santiago is the capital; the National Congress sits in Valparaíso.',
  },
  my: {
    capital: 'Kuala Lumpur',
    accepted: ['Kuala Lumpur', 'Putrajaya'],
    note: 'Kuala Lumpur is the capital; Putrajaya is the federal administrative centre.',
  },
  pw: {
    capital: 'Ngerulmud',
    accepted: ['Ngerulmud', 'Melekeok'],
    note: 'Ngerulmud, in Melekeok state, replaced Koror as capital in 2006.',
  },
  nr: {
    capital: 'Yaren',
    accepted: ['Yaren'],
    note: 'Nauru has no official capital; Yaren is the de facto seat of government.',
  },
  fm: {
    capital: 'Palikir',
    accepted: ['Palikir', 'Kolonia'],
    note: 'Palikir replaced nearby Kolonia as capital in 1989.',
  },
  ps: {
    capital: 'Jerusalem',
    accepted: ['Jerusalem', 'East Jerusalem', 'Ramallah'],
    latlng: [31.78, 35.22],
    note: 'Palestine claims Jerusalem as its capital; Ramallah is the administrative centre.',
  },
  sm: { capital: 'San Marino', accepted: ['San Marino', 'City of San Marino'] },
};

// Tiers: flag recognisability AND capital obscurity combined.
// Near-freebies (capital ≈ country name) are deliberately forced easy.
const EASY = new Set([
  'fr', 'gb', 'de', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'at', 'gr', 'ru',
  'cn', 'jp', 'in', 'us', 'ca', 'mx', 'br', 'ar', 'eg', 'tr', 'pl', 'cz',
  'hu', 'se', 'no', 'dk', 'fi', 'ie', 'is', 'au', 'nz', 'kr', 'th', 'cu',
  // near-freebies:
  'pa', 'gt', 'kw', 'dj', 'lu', 'mc', 'sg', 'va', 'sm', 'ad',
]);
const HARD = new Set([
  'ki', 'pw', 'nr', 'fm', 'mh', 'tv', 'vu', 'sb', 'to', 'ws', 'tl', 'bn',
  'bt', 'mv', 'bi', 'bj', 'tg', 'bf', 'gw', 'gq', 'ga', 'td', 'cf', 'cg',
  'ss', 'er', 'km', 'st', 'cv', 'sz', 'ls', 'mw', 'ne', 'mr', 'gm', 'sl',
  'lr', 'gn', 'dm', 'lc', 'vc', 'gd', 'ag', 'kn', 'sr', 'gy', 'bz', 'tj',
  'kg', 'tm', 'mm',
]);

function formatPop(p) {
  if (p >= 1e9) return `${(p / 1e9).toFixed(1)} billion`;
  if (p >= 1e7) return `${Math.round(p / 1e6)} million`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(1)} million`;
  return (Math.round(p / 1000) * 1000).toLocaleString('en-US');
}

// Three hints, least → most revealing, generated from structured data so they
// can never leak the capital's name.
function hintsFor(c) {
  const where = `Located in ${c.subregion || c.region}`;
  const n = (c.borders || []).length;
  let geo;
  if (c.landlocked) {
    geo = `Landlocked, sharing a border with ${n} ${n === 1 ? 'country' : 'countries'}`;
  } else if (n === 0) {
    geo = 'An island nation with no land borders';
  } else {
    geo = `Has a coastline and ${n} land ${n === 1 ? 'neighbour' : 'neighbours'}`;
  }
  const pop = `Home to about ${formatPop(c.population)} people`;
  return [where, geo, pop];
}

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`source fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const raw = await res.json();

const included = raw.filter(
  (c) => (c.unMember || OBSERVERS.includes(c.cca2)) && !EXCLUDED.includes(c.cca2),
);

const countries = included
  .map((c) => {
    const id = c.cca2.toLowerCase();
    const o = OVERRIDES[id] || {};
    const capital = o.capital ?? c.capital?.[0];
    if (!capital) {
      console.error(`No capital for ${c.name.common} (${id}) and no override — fix required`);
      process.exit(1);
    }
    const [lat, lng] = o.latlng ?? c.capitalInfo?.latlng ?? c.latlng ?? [null, null];
    return {
      id,
      name: c.name.common,
      capital,
      acceptedAnswers: o.accepted ?? [capital],
      lat,
      lng,
      region: c.region,
      subregion: c.subregion || c.region,
      population: c.population,
      tier: o.tier ?? (EASY.has(id) ? 'easy' : HARD.has(id) ? 'hard' : 'medium'),
      hints: o.hints ?? hintsFor(c),
      note: o.note ?? null,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const byTier = { easy: 0, medium: 0, hard: 0 };
for (const c of countries) byTier[c.tier]++;

await writeFile(OUT, JSON.stringify(countries, null, 2) + '\n');
console.log(`Wrote ${countries.length} countries (${byTier.easy} easy / ${byTier.medium} medium / ${byTier.hard} hard)`);
console.log(`Excluded by design: Kosovo, Taiwan, Western Sahara (contested recognition); Israel (owner's call)`);
