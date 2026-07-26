// Share-string generation. Pure — clipboard interaction lives in main.js.
// One emoji row per puzzle showing the FINAL guess only. Never flag emoji
// (they render as country-code letters on Windows Chrome and spoil the
// answer).

export function shareString({
  puzzleNo,
  mode,
  results,
  streakCurrent,
  rows,
  dark = false,
  colourblind = false,
  url = null,
}) {
  const solved = results.filter((r) => r > 0).length;
  const tile = {
    correct: colourblind ? '🟦' : '🟩',
    present: colourblind ? '🟧' : '🟨',
    absent: dark ? '⬛' : '⬜',
  };
  const header = `Flagle #${puzzleNo} · ${mode} · ${solved}/${results.length} · 🔥${streakCurrent}`;
  const lines = rows.map((row) => row.map((s) => tile[s]).join(''));
  const parts = [header, ...lines];
  if (url) parts.push(`Try your luck: ${url}`);
  return parts.join('\n');
}
