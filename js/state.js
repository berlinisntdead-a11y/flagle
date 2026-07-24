// Persistence: pure core (defaultState, migrate, applyCompletion) + thin
// localStorage shell (loadState/saveState take the storage object so tests
// can inject a fake).

export const STORAGE_KEY = 'fcg.v1.state';

export function defaultState() {
  return {
    version: 1,
    settings: { mode: 'easy', colourblind: false, reducedMotion: false },
    streak: {
      current: 0,
      max: 0,
      lastCompletedPuzzleNo: null,
      freezesAvailable: 1,
      freezeLastGrantedPuzzleNo: 0,
    },
    history: [],
    missLog: {},
    inProgress: null,
  };
}

// Unknown/missing version resets cleanly; known version shallow-merges over
// defaults so missing fields self-heal instead of crashing.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return defaultState();
  const d = defaultState();
  return {
    ...d,
    ...raw,
    settings: { ...d.settings, ...(typeof raw.settings === 'object' ? raw.settings : {}) },
    streak: { ...d.streak, ...(typeof raw.streak === 'object' ? raw.streak : {}) },
    history: Array.isArray(raw.history) ? raw.history : [],
    missLog: raw.missLog && typeof raw.missLog === 'object' ? raw.missLog : {},
    inProgress: raw.inProgress ?? null,
  };
}

// Streak update on completing today's round. Implements the spec table:
//   today === last            → already played, no change
//   today === last + 1        → increment
//   today === last + 2 + freeze → consume freeze (covers exactly ONE missed
//                               day), increment
//   bigger gap                → reset to 1 (freeze kept — it can't cover it)
//   last === null             → first ever play, streak = 1
//   today < last              → clock went backwards; change nothing
// After updating, a freeze may be granted: one per 7 puzzles, max 1 held.
export function applyCompletion(streak, todayNo) {
  const s = { ...streak };
  const last = s.lastCompletedPuzzleNo;
  let usedFreeze = false;

  if (last !== null && todayNo === last) return { streak: s, usedFreeze, alreadyPlayed: true };
  if (last !== null && todayNo < last) return { streak: s, usedFreeze, alreadyPlayed: false };

  if (last === null) {
    s.current = 1;
  } else if (todayNo === last + 1) {
    s.current += 1;
  } else if (todayNo === last + 2 && s.freezesAvailable > 0) {
    s.freezesAvailable -= 1;
    s.current += 1;
    usedFreeze = true;
  } else {
    s.current = 1;
  }

  s.lastCompletedPuzzleNo = todayNo;
  s.max = Math.max(s.max, s.current);

  if (s.freezesAvailable < 1 && todayNo - s.freezeLastGrantedPuzzleNo >= 7) {
    s.freezesAvailable = 1;
    s.freezeLastGrantedPuzzleNo = todayNo;
  }

  return { streak: s, usedFreeze, alreadyPlayed: false };
}

// --- IO shell ---

export function loadState(storage) {
  try {
    return migrate(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return defaultState();
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable (private mode) — the game still plays
  }
}
