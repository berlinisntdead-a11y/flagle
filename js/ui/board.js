// Tile grid. No tile for spaces — multi-word capitals render as groups with a
// visible gap, which is itself a structural hint. Fully re-rendered on each
// change (a few dozen cells, cheap), with a reveal animation on the newly
// committed row.

export class Board {
  constructor(el) {
    this.el = el;
  }

  // wordLens: letters per word of the answer, e.g. SAN JOSE → [3, 4]
  start(wordLens, maxRows) {
    this.wordLens = wordLens;
    this.total = wordLens.reduce((a, b) => a + b, 0);
    this.maxRows = maxRows;
    this.fitCells();
    this.render([], '', new Map());
  }

  // Shrink tiles so the longest word fits a narrow phone; wrap does the rest.
  fitCells() {
    if (!this.wordLens) return;
    const longest = Math.max(...this.wordLens);
    const available = Math.min(window.innerWidth, 512) - 24;
    const px = Math.floor((available - (longest - 1) * 4) / longest);
    const size = Math.max(16, Math.min(42, px));
    this.el.style.setProperty('--cell', `${size}px`);
  }

  // committed: [{letters, scores}] (letters de-spaced), active: letters typed
  // so far, revealed: Map(position → letter) of free green reveals shown on
  // the empty row.
  render(committed, active, revealed, { animateLast = false } = {}) {
    this.fitCells();
    this.el.innerHTML = '';
    for (let r = 0; r < this.maxRows; r++) {
      const g = committed[r];
      let row;
      if (g) {
        row = this.buildRow(g.letters, g.scores, null);
        if (animateLast && r === committed.length - 1) {
          row.classList.add('revealing');
          [...row.querySelectorAll('.cell')].forEach((c, i) => {
            c.style.animationDelay = `${Math.min(i * 60, 900)}ms`;
          });
        }
      } else if (r === committed.length) {
        row = this.buildRow(active, null, revealed);
        this.activeRow = row;
      } else {
        row = this.buildRow('', null, null);
      }
      this.el.append(row);
    }
  }

  buildRow(letters, scores, revealed) {
    const row = document.createElement('div');
    row.className = 'board-row';
    let pos = 0;
    const groups = [...this.wordLens];
    // overflow letters (easy mode) get extra cells appended to the last group
    if (letters.length > this.total) groups[groups.length - 1] += letters.length - this.total;
    for (const len of groups) {
      const group = document.createElement('div');
      group.className = 'word-group';
      for (let i = 0; i < len; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const ch = letters[pos];
        if (ch) {
          cell.textContent = ch;
          cell.classList.add(scores ? scores[pos] : 'filled');
        } else if (revealed && revealed.has(pos)) {
          cell.textContent = revealed.get(pos);
          cell.classList.add('hinted');
        }
        pos++;
        group.append(cell);
      }
      row.append(group);
    }
    return row;
  }

  shake() {
    if (!this.activeRow) return;
    this.activeRow.classList.remove('shake');
    void this.activeRow.offsetWidth; // restart the animation
    this.activeRow.classList.add('shake');
  }
}
