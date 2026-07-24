import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState,
  migrate,
  applyCompletion,
  loadState,
  saveState,
  STORAGE_KEY,
} from '../js/state.js';

// freezeLastGrantedPuzzleNo is recent (98) so the 7-puzzle regrant doesn't
// kick in during these scenarios unless a test overrides it deliberately.
const streak = (over = {}) => ({
  current: 5,
  max: 9,
  lastCompletedPuzzleNo: 100,
  freezesAvailable: 1,
  freezeLastGrantedPuzzleNo: 98,
  ...over,
});

// --- every row of the spec's streak table ---

test('first ever play: streak = 1', () => {
  const { streak: s, alreadyPlayed } = applyCompletion(
    streak({ current: 0, max: 0, lastCompletedPuzzleNo: null }),
    42,
  );
  assert.equal(s.current, 1);
  assert.equal(s.max, 1);
  assert.equal(s.lastCompletedPuzzleNo, 42);
  assert.equal(alreadyPlayed, false);
});

test('same day again: no change, flagged alreadyPlayed', () => {
  const { streak: s, alreadyPlayed } = applyCompletion(streak(), 100);
  assert.equal(alreadyPlayed, true);
  assert.equal(s.current, 5);
  assert.equal(s.lastCompletedPuzzleNo, 100);
});

test('consecutive day: increment', () => {
  const { streak: s, usedFreeze } = applyCompletion(streak(), 101);
  assert.equal(s.current, 6);
  assert.equal(usedFreeze, false);
});

test('one missed day with freeze: consume freeze, increment', () => {
  const { streak: s, usedFreeze } = applyCompletion(streak(), 102);
  assert.equal(usedFreeze, true);
  assert.equal(s.current, 6);
  assert.equal(s.freezesAvailable, 0);
});

test('one missed day without freeze: reset to 1', () => {
  const { streak: s, usedFreeze } = applyCompletion(streak({ freezesAvailable: 0 }), 102);
  assert.equal(usedFreeze, false);
  assert.equal(s.current, 1);
});

test('two missed days: freeze cannot cover, reset to 1, freeze kept', () => {
  const { streak: s, usedFreeze } = applyCompletion(streak(), 103);
  assert.equal(usedFreeze, false);
  assert.equal(s.current, 1);
  assert.equal(s.freezesAvailable, 1);
});

test('clock went backwards: nothing changes, no crash', () => {
  const { streak: s, alreadyPlayed } = applyCompletion(streak(), 99);
  assert.equal(alreadyPlayed, false);
  assert.equal(s.current, 5);
  assert.equal(s.lastCompletedPuzzleNo, 100);
});

test('max never decreases, updates when passed', () => {
  const { streak: s } = applyCompletion(streak({ current: 9, max: 9 }), 101);
  assert.equal(s.current, 10);
  assert.equal(s.max, 10);
});

// --- freeze grant: one per 7 puzzles, capped at 1 held ---

test('no grant while a freeze is already held', () => {
  const { streak: s } = applyCompletion(streak({ freezeLastGrantedPuzzleNo: 0 }), 101);
  assert.equal(s.freezesAvailable, 1);
  assert.equal(s.freezeLastGrantedPuzzleNo, 0); // unchanged — no new grant
});

test('grant refills after 7+ puzzles without one', () => {
  const { streak: s } = applyCompletion(
    streak({ freezesAvailable: 0, freezeLastGrantedPuzzleNo: 93 }),
    101,
  );
  assert.equal(s.freezesAvailable, 1);
  assert.equal(s.freezeLastGrantedPuzzleNo, 101);
});

test('no grant before 7 puzzles have passed', () => {
  const { streak: s } = applyCompletion(
    streak({ freezesAvailable: 0, freezeLastGrantedPuzzleNo: 96 }),
    101,
  );
  assert.equal(s.freezesAvailable, 0);
});

test('freeze consumed and immediately re-earned when grant window already passed', () => {
  // documents deliberate behaviour: consume happens first, grant check after
  const { streak: s, usedFreeze } = applyCompletion(
    streak({ freezeLastGrantedPuzzleNo: 90 }),
    102,
  );
  assert.equal(usedFreeze, true);
  assert.equal(s.freezesAvailable, 1);
  assert.equal(s.freezeLastGrantedPuzzleNo, 102);
});

// --- migration & corrupt storage ---

test('migrate: null/undefined/garbage → clean default', () => {
  for (const bad of [null, undefined, 'garbage', 42, [], { version: 99 }, {}]) {
    assert.deepEqual(migrate(bad), defaultState());
  }
});

test('migrate: version 1 with missing fields self-heals', () => {
  const m = migrate({ version: 1, settings: { mode: 'hard' } });
  assert.equal(m.settings.mode, 'hard');
  assert.equal(m.settings.colourblind, false);
  assert.equal(m.streak.freezesAvailable, 1);
  assert.deepEqual(m.history, []);
  assert.equal(m.inProgress, null);
});

test('loadState: corrupted JSON blob does not throw', () => {
  const fake = { getItem: () => '{not json!!', setItem() {} };
  assert.deepEqual(loadState(fake), defaultState());
});

test('loadState: storage that throws does not throw', () => {
  const fake = {
    getItem() {
      throw new Error('denied');
    },
  };
  assert.deepEqual(loadState(fake), defaultState());
});

test('save/load round-trip', () => {
  const mem = new Map();
  const fake = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
  };
  const state = defaultState();
  state.settings.mode = 'hard';
  state.missLog = { hu: [142] };
  saveState(fake, state);
  assert.ok(mem.has(STORAGE_KEY));
  assert.deepEqual(loadState(fake), state);
});

test('saveState: quota error is swallowed', () => {
  const fake = {
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  assert.doesNotThrow(() => saveState(fake, defaultState()));
});
