// On-screen QWERTY keyboard. Keys carry cumulative best-known state within a
// puzzle: green > yellow > grey, never downgraded.

const RANK = { absent: 1, present: 2, correct: 3 };

export class Keyboard {
  constructor(el, onKey) {
    this.el = el;
    this.states = new Map();
    el.innerHTML = '';
    const rows = [
      [...'QWERTYUIOP'],
      [...'ASDFGHJKL'],
      ['ENTER', ...'ZXCVBNM', '⌫'],
      ['SPACE'],
    ];
    for (const keys of rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      for (const k of keys) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'key';
        btn.dataset.key = k;
        btn.textContent = k === 'SPACE' ? '␣ space' : k === '⌫' ? '⌫' : k;
        if (k === 'ENTER' || k === '⌫') btn.classList.add('wide');
        if (k === 'SPACE') btn.classList.add('space');
        if (k === '⌫') btn.setAttribute('aria-label', 'Backspace');
        btn.addEventListener('click', () => onKey(k === '⌫' ? 'BACKSPACE' : k));
        rowEl.append(btn);
      }
      this.el.append(rowEl);
    }
  }

  // letterScores: Map(letter → best score from the latest guess)
  applyScores(letterScores) {
    for (const [letter, score] of letterScores) {
      const prev = this.states.get(letter);
      if (!prev || RANK[score] > RANK[prev]) this.states.set(letter, score);
    }
    this.paint();
  }

  paint() {
    for (const btn of this.el.querySelectorAll('.key')) {
      btn.classList.remove('correct', 'present', 'absent');
      const s = this.states.get(btn.dataset.key);
      if (s) btn.classList.add(s);
    }
  }

  reset() {
    this.states.clear();
    this.paint();
  }
}
