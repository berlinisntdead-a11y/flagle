import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreGuess } from '../js/scoring.js';

const C = 'correct';
const P = 'present';
const A = 'absent';

// Every row of the spec's table, with two corrections (flagged to the owner):
// - AAAA vs ABAB: the answer has A at positions 0 AND 2, so pass 1 marks two
//   greens — the spec's "correct, present, absent, absent" is unreachable
//   under its own algorithm. True result: correct, absent, correct, absent.
// - LIMA vs ROME: both words have M at index 2 (green), so "absent ×4" is
//   impossible. The all-absent case is covered by LIMA vs BERN instead.
const cases = [
  ['BELGRADE', 'BUDAPEST', [C, P, A, A, A, P, P, A]],
  ['DUSHANBE', 'BUDAPEST', [P, C, P, A, P, A, P, P]],
  ['BUDAPEST', 'BUDAPEST', [C, C, C, C, C, C, C, C]],
  ['AAAA', 'ABAB', [C, A, C, A]],
  ['ABAB', 'AAAA', [C, A, C, A]],
  ['LIMA', 'ROME', [A, A, C, A]],
  ['LIMA', 'BERN', [A, A, A, A]],
  ['PARIS', 'PARIS', [C, C, C, C, C]],
  ['ROMEROME', 'ROME', [C, C, C, C, A, A, A, A]],
];

for (const [guess, answer, expected] of cases) {
  test(`${guess} vs ${answer}`, () => {
    assert.deepEqual(scoreGuess(guess, answer), expected);
  });
}

test('guess shorter than answer scores only its own positions', () => {
  assert.deepEqual(scoreGuess('ROME', 'ROMEO'), [C, C, C, C]);
});

test('overflow positions can be present but never correct', () => {
  // answer OSLO exhausted by greens; overflow O has no tally left
  assert.deepEqual(scoreGuess('OSLOO', 'OSLO'), [C, C, C, C, A]);
  // overflow letter that IS still in tally scores present
  assert.deepEqual(scoreGuess('ROMA', 'ROM'), [C, C, C, A]);
  assert.deepEqual(scoreGuess('XROM', 'ROM'), [A, P, P, P]);
});
