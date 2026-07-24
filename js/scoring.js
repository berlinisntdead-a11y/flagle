// Wordle-style letter scoring. Pure — inputs are already normalised (and
// de-spaced by the caller; multi-word gaps are a rendering concern, not a
// scoring one).

// Two-pass algorithm so duplicate letters behave correctly:
// pass 1 claims exact-position matches and consumes them from the answer's
// letter tally; pass 2 hands out "present" only while tally remains.
// Positions beyond the answer's length can never be "correct".
export function scoreGuess(guess, answer) {
  const result = new Array(guess.length).fill('absent');
  const tally = {};
  for (const ch of answer) tally[ch] = (tally[ch] || 0) + 1;

  const overlap = Math.min(guess.length, answer.length);
  for (let i = 0; i < overlap; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
      tally[guess[i]]--;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (tally[ch] > 0) {
      result[i] = 'present';
      tally[ch]--;
    }
  }

  return result;
}
