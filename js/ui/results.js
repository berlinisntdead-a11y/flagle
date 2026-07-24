// End-of-round screen: every answer with flag, capital and note — the
// learning happens here. Plus streak, learned counter, share, and a countdown
// to the next round.

export function showResults(dialog, {
  round, // [{country, result}]
  streak,
  usedFreeze,
  learnedCount,
  onShare,
}) {
  const content = dialog.querySelector('#results-content');
  const solved = round.filter((r) => r.result > 0).length;

  const rows = round
    .map(({ country, result }) => {
      const tries = result > 0 ? `${result}` : '✗';
      const note = country.note ? `<div class="note">${esc(country.note)}</div>` : '';
      return `<div class="result-row">
        <img src="flags/${country.id}.svg" alt="Flag of ${esc(country.name)}" width="48" height="32" />
        <div class="what">
          <div class="country-name">${esc(country.name)}</div>
          <div class="capital-name">${esc(country.capital)}</div>
          ${note}
        </div>
        <div class="tries">${tries}</div>
      </div>`;
    })
    .join('');

  content.innerHTML = `
    <h2>Round done — ${solved}/5</h2>
    ${usedFreeze ? '<div class="freeze-notice">🧊 Streak freeze used — streak safe!</div>' : ''}
    ${rows}
    <div class="results-stats">
      <div><span class="num">🔥${streak.current}</span><span class="lbl">streak</span></div>
      <div><span class="num">${streak.max}</span><span class="lbl">best</span></div>
      <div><span class="num">${learnedCount}</span><span class="lbl">learned</span></div>
      <div><span class="num">${streak.freezesAvailable > 0 ? '🧊' : '—'}</span><span class="lbl">freeze</span></div>
    </div>
    <div class="results-actions">
      <button id="share-btn" class="primary-btn">Share</button>
      <button id="results-close">Close</button>
    </div>
    <p id="countdown"></p>
  `;

  content.querySelector('#share-btn').addEventListener('click', onShare);
  content.querySelector('#results-close').addEventListener('click', () => dialog.close());

  const countdownEl = content.querySelector('#countdown');
  const tick = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ms = midnight - now;
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    countdownEl.textContent = `Next round in ${h}:${m}:${s}`;
  };
  tick();
  clearInterval(showResults._timer);
  showResults._timer = setInterval(tick, 1000);
  dialog.addEventListener('close', () => clearInterval(showResults._timer), { once: true });

  if (!dialog.open) dialog.showModal();
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
