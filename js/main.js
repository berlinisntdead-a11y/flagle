// Bootstrap + round orchestration. The orchestrator drives an array of
// puzzle instances through a small interface (init/submitGuess/serialise/
// shareRow) without knowing their type, so phase-2 puzzle formats slot in
// beside FlagCapitalPuzzle.

import { normalise, levenshtein } from './normalise.js';
import { scoreGuess } from './scoring.js';
import { puzzleNumber, dailyPuzzle } from './puzzle.js';
import { loadState, saveState, applyCompletion } from './state.js';
import { shareString } from './share.js';
import { Board } from './ui/board.js';
import { Keyboard } from './ui/keyboard.js';
import { Hints } from './ui/hints.js';
import { showResults } from './ui/results.js';

const MODES = {
  easy: { maxGuesses: 6, hintAfter: [1, 2, 3], freeFirstLetter: true, fuzzy: true, dictionary: false, enforceLength: false },
  hard: { maxGuesses: 5, hintAfter: [2, 3, 4], freeFirstLetter: false, fuzzy: false, dictionary: true, enforceLength: true },
};

const deSpace = (s) => s.replace(/ /g, '');
const $ = (id) => document.getElementById(id);

const countries = await fetch('./data/countries.json').then((r) => r.json());

// dictionary of every accepted answer, for hard mode's "real capital" check
const DICT = new Map(); // normalised de-spaced key → display form
for (const c of countries) {
  for (const a of c.acceptedAnswers) DICT.set(deSpace(normalise(a)), a);
}

function didYouMean(key) {
  for (const [k, display] of DICT) {
    if (levenshtein(key, k) <= 1) return display;
  }
  return null;
}

// --- puzzle type: flag → capital ---

class FlagCapitalPuzzle {
  constructor(country, modeName) {
    this.country = country;
    this.cfg = MODES[modeName];
    this.answerNorm = normalise(country.capital);
    this.answerKey = deSpace(this.answerNorm);
    this.wordLens = this.answerNorm.split(' ').map((w) => w.length);
    this.guesses = [];
    this.scores = [];
    this.revealed = new Map();
    this.done = false;
    this.result = null;
    if (this.cfg.freeFirstLetter) this.revealed.set(0, this.answerKey[0]);
  }

  submitGuess(raw) {
    const key = deSpace(normalise(raw));
    if (key.length < 3) return { status: 'short' };
    if (this.cfg.enforceLength && key.length !== this.answerKey.length)
      return { status: 'length', wanted: this.answerKey.length };
    if (this.cfg.dictionary && !DICT.has(key))
      return { status: 'notword', suggestion: didYouMean(key) };

    let matched = null;
    let fuzzy = false;
    for (const a of this.country.acceptedAnswers) {
      if (key === deSpace(normalise(a))) {
        matched = a;
        break;
      }
    }
    if (!matched && this.cfg.fuzzy) {
      for (const a of this.country.acceptedAnswers) {
        const ak = deSpace(normalise(a));
        if (levenshtein(key, ak) <= (ak.length > 10 ? 2 : 1)) {
          matched = a;
          fuzzy = true;
          break;
        }
      }
    }

    const scores = matched ? key.split('').map(() => 'correct') : scoreGuess(key, this.answerKey);
    this.guesses.push(key);
    this.scores.push(scores);

    if (matched) {
      this.done = true;
      this.result = this.guesses.length;
      return { status: 'correct', matched, fuzzy, scores };
    }
    if (this.guesses.length >= this.cfg.maxGuesses) {
      this.done = true;
      this.result = -1;
      return { status: 'failed', scores };
    }
    if (this.guesses.length === this.cfg.maxGuesses - 1) this.revealFreeLetter();
    return { status: 'wrong', scores };
  }

  // last-chance mercy: turn the leftmost unrevealed, never-green letter green
  revealFreeLetter() {
    const greens = new Set(this.revealed.keys());
    for (const sc of this.scores) sc.forEach((s, i) => s === 'correct' && greens.add(i));
    for (let i = 0; i < this.answerKey.length; i++) {
      if (!greens.has(i)) {
        this.revealed.set(i, this.answerKey[i]);
        return;
      }
    }
  }

  hintsDueAfter(guessCount) {
    return this.cfg.hintAfter.map((n, j) => (n === guessCount ? j : -1)).filter((j) => j >= 0);
  }

  serialise() {
    return [...this.guesses];
  }

  shareRow() {
    return this.scores[this.scores.length - 1] ?? [];
  }
}

// --- app state & elements ---

const state = loadState(localStorage);
const todayNo = puzzleNumber(new Date());
const deckCache = new Map();
const roundCountries = dailyPuzzle(countries, todayNo, deckCache);

const board = new Board($('board'));
const keyboard = new Keyboard($('keyboard'), onKey);
const hints = new Hints($('hints'));
const flagImg = $('flag');
const revealPanel = $('reveal-panel');

let puzzles = [];
let idx = 0;
let typed = '';
let roundOver = false;
let lastCompletion = { usedFreeze: false };

flagImg.addEventListener('error', () => {
  flagImg.hidden = true;
  $('flag-missing').hidden = false;
});

// --- helpers ---

let toastTimer;
function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function announce(msg) {
  $('live').textContent = msg;
}

function saveProgress() {
  state.inProgress = roundOver
    ? null
    : { puzzleNo: todayNo, index: idx, guesses: puzzles.map((p) => p.serialise()) };
  saveState(localStorage, state);
}

function paintProgress() {
  const ol = $('progress');
  ol.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const li = document.createElement('li');
    const p = puzzles[i];
    if (p?.done) li.className = p.result > 0 ? 'won' : 'lost';
    else if (i === idx && !roundOver) li.className = 'current';
    ol.append(li);
  }
}

function paintStreak() {
  $('streak-count').textContent = state.streak.current;
}

// --- round flow ---

function buildPuzzles() {
  puzzles = roundCountries.map((c) => new FlagCapitalPuzzle(c, state.settings.mode));
}

function startPuzzle(replayGuesses = []) {
  const p = puzzles[idx];
  typed = '';
  flagImg.hidden = false;
  $('flag-missing').hidden = true;
  flagImg.src = `flags/${p.country.id}.svg`;
  flagImg.alt = 'Flag to identify';
  revealPanel.hidden = true;
  keyboard.reset();
  hints.reset();
  board.start(p.wordLens, p.cfg.maxGuesses);
  for (const g of replayGuesses) applyGuess(g, { silent: true });
  renderBoard();
  paintProgress();
  const next = roundCountries[idx + 1];
  if (next) new Image().src = `flags/${next.id}.svg`; // no flash between puzzles
}

function renderBoard(opts) {
  const p = puzzles[idx];
  board.render(
    p.guesses.map((g, i) => ({ letters: g, scores: p.scores[i] })),
    deSpace(normalise(typed)),
    p.revealed,
    opts,
  );
}

function applyGuess(raw, { silent = false } = {}) {
  const p = puzzles[idx];
  const res = p.submitGuess(raw);

  if (res.status === 'short') {
    if (!silent) {
      board.shake();
      toast('Type at least 3 letters');
    }
    return;
  }
  if (res.status === 'length') {
    if (!silent) {
      board.shake();
      toast(`Hard mode: the answer has ${res.wanted} letters`);
    }
    return;
  }
  if (res.status === 'notword') {
    if (!silent) {
      board.shake();
      toast(res.suggestion ? `Did you mean ${res.suggestion}?` : 'Not a capital I know');
    }
    return;
  }

  typed = '';
  const scoresRow = res.scores;
  const letterBest = new Map();
  const RANK = { absent: 1, present: 2, correct: 3 };
  const key = p.guesses[p.guesses.length - 1];
  scoresRow.forEach((s, i) => {
    const ch = key[i];
    if (!letterBest.has(ch) || RANK[s] > RANK[letterBest.get(ch)]) letterBest.set(ch, s);
  });
  keyboard.applyScores(letterBest);

  if (!silent) {
    renderBoard({ animateLast: true });
    const nC = scoresRow.filter((s) => s === 'correct').length;
    const nP = scoresRow.filter((s) => s === 'present').length;
    announce(`Guess ${p.guesses.length}: ${nC} in the right spot, ${nP} elsewhere in the word.`);
  }

  if (res.status === 'correct' || res.status === 'failed') {
    finishPuzzle(res, silent);
    return;
  }

  // wrong guess buys information: scheduled hints, then a mercy letter
  for (const j of p.hintsDueAfter(p.guesses.length)) {
    hints.reveal(p.country.hints[j]);
  }
  if (!silent) saveProgress();
}

function finishPuzzle(res, silent = false) {
  const p = puzzles[idx];
  flagImg.alt = `Flag of ${p.country.name}`;
  const { country } = p;
  let text;
  if (res.status === 'correct') {
    text = res.fuzzy
      ? `Close enough — it's spelled ${country.capital}. Capital of ${country.name}.`
      : `✓ ${country.capital} — capital of ${country.name}.`;
  } else {
    text = `✗ It was ${country.capital} — capital of ${country.name}.`;
  }
  if (country.note) text += ` ${country.note}`;
  $('reveal-text').textContent = text;
  $('next-btn').textContent = idx < 4 ? 'Next flag' : 'See results';
  revealPanel.hidden = false;
  if (!silent) {
    announce(text);
    saveProgress();
  }
  paintProgress();
}

function finishRound() {
  roundOver = true;
  const results = puzzles.map((p) => p.result);

  const { streak, usedFreeze, alreadyPlayed } = applyCompletion(state.streak, todayNo);
  lastCompletion = { usedFreeze };
  if (!alreadyPlayed) {
    state.streak = streak;
    state.history.push({
      puzzleNo: todayNo,
      mode: state.settings.mode,
      results,
      completedAt: new Date().toISOString(),
    });
    // collect misses from day one — phase 2's spaced repetition feeds on this
    puzzles.forEach((p) => {
      if (p.result === -1 || p.result >= 3) {
        (state.missLog[p.country.id] ??= []).push(todayNo);
      }
    });
  }
  state.inProgress = null;
  saveState(localStorage, state);
  paintStreak();
  if (usedFreeze) toast('🧊 Streak freeze used');
  openResults();
}

function openResults() {
  const entry = state.history.find((h) => h.puzzleNo === todayNo);
  const results = entry ? entry.results : puzzles.map((p) => p.result);
  showResults($('results-dialog'), {
    round: roundCountries.map((country, i) => ({ country, result: results[i] })),
    streak: state.streak,
    usedFreeze: lastCompletion.usedFreeze,
    learnedCount: learnedCount(),
    onShare: share,
  });
}

// countries answered in 1–2 tries in their two most recent appearances
function learnedCount() {
  const appearances = new Map();
  for (const h of state.history) {
    dailyPuzzle(countries, h.puzzleNo, deckCache).forEach((c, i) => {
      if (!appearances.has(c.id)) appearances.set(c.id, []);
      appearances.get(c.id).push({ no: h.puzzleNo, r: h.results[i] });
    });
  }
  let n = 0;
  for (const list of appearances.values()) {
    const recent = list.sort((a, b) => a.no - b.no).slice(-2);
    if (recent.length && recent.every((x) => x.r === 1 || x.r === 2)) n++;
  }
  return n;
}

async function share() {
  const entry = state.history.find((h) => h.puzzleNo === todayNo);
  const text = shareString({
    puzzleNo: todayNo,
    mode: entry?.mode ?? state.settings.mode,
    results: entry?.results ?? puzzles.map((p) => p.result),
    streakCurrent: state.streak.current,
    rows: puzzles.map((p) => p.shareRow()).filter((r) => r.length),
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    colourblind: state.settings.colourblind,
    url: location.origin + location.pathname,
  });
  if (navigator.share && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      /* cancelled or unsupported — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Copied to clipboard');
  }
}

// --- input ---

function onKey(k) {
  if (roundOver) return;
  const p = puzzles[idx];
  if (p.done) {
    if (k === 'ENTER') $('next-btn').click();
    return;
  }
  if (k === 'ENTER') {
    applyGuess(typed);
    return;
  }
  if (k === 'BACKSPACE') {
    typed = typed.slice(0, -1);
    renderBoard();
    return;
  }
  if (k === 'SPACE') {
    typed += ' ';
    return;
  }
  if (/^[A-Z]$/.test(k)) {
    const max = p.cfg.enforceLength ? p.answerKey.length : 30;
    if (deSpace(normalise(typed)).length < max) {
      typed += k;
      renderBoard();
    }
  }
}

window.addEventListener('resize', () => board.fitCells());

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('settings-dialog').open || $('results-dialog').open) return;
  if (e.key === 'Enter') onKey('ENTER');
  else if (e.key === 'Backspace') onKey('BACKSPACE');
  else if (e.key === ' ') {
    e.preventDefault();
    onKey('SPACE');
  } else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
});

$('next-btn').addEventListener('click', () => {
  if (roundOver) {
    openResults();
    return;
  }
  if (idx < 4) {
    idx++;
    startPuzzle();
    saveProgress();
  } else {
    finishRound();
  }
});

// --- settings ---

function applySettingsToDom() {
  document.documentElement.classList.toggle('cb-mode', state.settings.colourblind);
  document.documentElement.classList.toggle('no-motion', state.settings.reducedMotion);
  document.querySelector(`input[name="mode"][value="${state.settings.mode}"]`).checked = true;
  $('opt-colourblind').checked = state.settings.colourblind;
  $('opt-reduced-motion').checked = state.settings.reducedMotion;
}

$('settings-btn').addEventListener('click', () => $('settings-dialog').showModal());
$('settings-close').addEventListener('click', () => $('settings-dialog').close());

$('opt-colourblind').addEventListener('change', (e) => {
  state.settings.colourblind = e.target.checked;
  applySettingsToDom();
  saveState(localStorage, state);
});

$('opt-reduced-motion').addEventListener('change', (e) => {
  state.settings.reducedMotion = e.target.checked;
  applySettingsToDom();
  saveState(localStorage, state);
});

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener('change', (e) => {
    if (state.settings.mode === e.target.value) return;
    state.settings.mode = e.target.value;
    saveState(localStorage, state);
    if (!roundOver && !state.history.some((h) => h.puzzleNo === todayNo)) {
      // switching mid-round restarts the current puzzle (and re-modes the rest)
      for (let i = idx; i < 5; i++) puzzles[i] = new FlagCapitalPuzzle(roundCountries[i], state.settings.mode);
      startPuzzle();
      saveProgress();
      toast(`${e.target.value === 'easy' ? 'Easy' : 'Hard'} mode — puzzle restarted`);
    }
  });
}

// --- boot ---

applySettingsToDom();
paintStreak();
buildPuzzles();

if (state.history.some((h) => h.puzzleNo === todayNo)) {
  // already played today: results immediately, never a blank board
  roundOver = true;
  idx = 4;
  flagImg.src = `flags/${roundCountries[4].id}.svg`;
  flagImg.alt = `Flag of ${roundCountries[4].name}`;
  $('reveal-text').textContent = "You've finished today's round.";
  $('next-btn').textContent = 'See results';
  revealPanel.hidden = false;
  paintProgress();
  openResults();
} else if (state.inProgress && state.inProgress.puzzleNo === todayNo) {
  const saved = state.inProgress.guesses ?? [];
  idx = Math.min(state.inProgress.index ?? 0, 4);
  for (let i = 0; i < idx; i++) {
    for (const g of saved[i] ?? []) puzzles[i].submitGuess(g);
  }
  startPuzzle(saved[idx] ?? []);
} else {
  state.inProgress = null;
  startPuzzle();
  saveProgress();
}
