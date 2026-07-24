import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { puzzleNumber, dailyPuzzle } from '../js/puzzle.js';

const countries = JSON.parse(
  readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8'),
);

test('puzzleNumber counts local days since 2026-01-01', () => {
  assert.equal(puzzleNumber(new Date(2026, 0, 1)), 0);
  assert.equal(puzzleNumber(new Date(2026, 0, 2)), 1);
  assert.equal(puzzleNumber(new Date(2026, 0, 1, 23, 59, 59)), 0); // time of day irrelevant
  assert.equal(puzzleNumber(new Date(2026, 11, 31)), 364);
  assert.equal(puzzleNumber(new Date(2027, 0, 1)), 365);
});

test('same date → same puzzle, run twice (fresh caches)', () => {
  const a = dailyPuzzle(countries, 142, new Map()).map((c) => c.id);
  const b = dailyPuzzle(countries, 142, new Map()).map((c) => c.id);
  assert.deepEqual(a, b);
});

test('every day draws 1 easy, 3 medium, 1 hard — five distinct countries', () => {
  const cache = new Map();
  for (let day = 0; day <= 500; day++) {
    const picks = dailyPuzzle(countries, day, cache);
    assert.deepEqual(
      picks.map((c) => c.tier),
      ['easy', 'medium', 'medium', 'medium', 'hard'],
      `day ${day}: wrong tier mix`,
    );
    assert.equal(new Set(picks.map((c) => c.id)).size, 5, `day ${day}: duplicate country`);
  }
});

test('no country appears twice within any 30-day window, days 0–500', () => {
  const cache = new Map();
  const lastSeen = new Map();
  for (let day = 0; day <= 500; day++) {
    for (const c of dailyPuzzle(countries, day, cache)) {
      if (lastSeen.has(c.id)) {
        const gap = day - lastSeen.get(c.id);
        assert.ok(
          gap >= 30,
          `${c.name} (${c.tier}) repeats after ${gap} days (day ${lastSeen.get(c.id)} → ${day})`,
        );
      }
      lastSeen.set(c.id, day);
    }
  }
});

test('negative puzzle numbers clamp instead of crashing', () => {
  assert.deepEqual(
    dailyPuzzle(countries, -5, new Map()).map((c) => c.id),
    dailyPuzzle(countries, 0, new Map()).map((c) => c.id),
  );
});
