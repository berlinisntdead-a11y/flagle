// Daily puzzle selection. Pure and stateless: day N's puzzle is computable
// from N alone, on any device, forever. Never calls new Date() — callers
// inject the date.

// Days since 2026-01-01, from LOCAL date parts so a new puzzle lands at the
// player's midnight. Math.round absorbs DST hour shifts.
export function puzzleNumber(date) {
  const epoch = new Date(2026, 0, 1);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day - epoch) / 86400000);
}

// FNV-1a 32-bit string hash → PRNG seed.
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Minimum gap in DRAWS between two appearances of one country, sized so no
// country repeats within any 30-day window: easy/hard draw 1/day, medium
// draws 3/day (a 92-draw gap always spans ≥ 30 days).
const MIN_GAP = { easy: 30, medium: 92, hard: 30 };

function shuffled(ids, tier, cycle) {
  const rand = mulberry32(hashSeed(`deck-${tier}-cycle-${cycle}`));
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Order of a deck for a given cycle: seeded Fisher–Yates, then rebuilt so the
// head of this cycle never repeats the tail of the previous one within
// MIN_GAP draws. Rebuild is greedy: for each position take the first element
// (in shuffle order) whose last appearance is far enough back. One always
// exists — an element last seen d draws ago is eligible from position W-d,
// and W ≤ deck length means eligible elements outnumber filled positions at
// every step.
function cycleOrder(ids, tier, cycle, cache) {
  for (let c = 0; c <= cycle; c++) {
    const key = `${tier}:${c}`;
    if (cache.has(key)) continue;
    let deck = shuffled(ids, tier, c);
    if (c > 0) {
      const prev = cache.get(`${tier}:${c - 1}`);
      const L = deck.length;
      const W = Math.min(MIN_GAP[tier], L);
      const drawsAgo = new Map(prev.map((id, p) => [id, L - p]));
      const pool = deck;
      deck = [];
      for (let i = 0; i < L; i++) {
        const at = pool.findIndex((id) => drawsAgo.get(id) + i >= W);
        deck.push(pool.splice(at === -1 ? 0 : at, 1)[0]);
      }
    }
    cache.set(key, deck);
  }
  return cache.get(`${tier}:${cycle}`);
}

// The day's five countries: 1 easy, 3 medium, 1 hard, in that play order.
// `cache` memoises per-cycle deck orders; pass the same Map across calls.
export function dailyPuzzle(countries, puzzleNo, cache = new Map()) {
  const n = Math.max(0, puzzleNo);
  const byTier = { easy: [], medium: [], hard: [] };
  for (const c of countries) byTier[c.tier].push(c);
  const byId = new Map(countries.map((c) => [c.id, c]));

  const pick = (tier, index) => {
    const ids = byTier[tier].map((c) => c.id).sort();
    const order = cycleOrder(ids, tier, Math.floor(index / ids.length), cache);
    return byId.get(order[index % ids.length]);
  };

  return [
    pick('easy', n),
    pick('medium', n * 3),
    pick('medium', n * 3 + 1),
    pick('medium', n * 3 + 2),
    pick('hard', n),
  ];
}
