// Hint ladder. The list itself is aria-live=polite (set in the HTML), so new
// hints are announced as they appear.

export class Hints {
  constructor(el) {
    this.el = el;
  }

  reset() {
    this.el.innerHTML = '';
  }

  reveal(text) {
    const li = document.createElement('li');
    li.textContent = text;
    this.el.append(li);
  }
}
