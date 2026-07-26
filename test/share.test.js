import test from 'node:test';
import assert from 'node:assert/strict';
import { shareString } from '../js/share.js';

const base = {
  puzzleNo: 142,
  mode: 'hard',
  results: [2, 4, 3, -1, 1],
  streakCurrent: 18,
  rows: [
    ['correct', 'present', 'absent'],
    ['correct', 'correct', 'correct'],
  ],
};

test('header + one row per puzzle, light palette', () => {
  assert.equal(
    shareString(base),
    'Flagle #142 · hard · 4/5 · 🔥18\n🟩🟨⬜\n🟩🟩🟩',
  );
});

test('dark mode swaps absent tile', () => {
  assert.ok(shareString({ ...base, dark: true }).includes('🟩🟨⬛'));
});

test('colourblind palette uses blue/orange', () => {
  assert.ok(shareString({ ...base, colourblind: true }).includes('🟦🟧⬜'));
});

test('url appends an invite line; absent by default', () => {
  const url = 'https://example.com/flagle/';
  assert.ok(shareString({ ...base, url }).endsWith(`Try your luck: ${url}`));
  assert.ok(!shareString(base).includes('Try your luck'));
});

test('never contains flag emoji (they spoil on Windows Chrome)', () => {
  const s = shareString(base);
  assert.ok(!/[\u{1F1E6}-\u{1F1FF}]/u.test(s));
});
