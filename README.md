# Flagle

A daily flag → capital game. Five flags a day; type the capital, Wordle-style
letter colouring converges you on the answer.

## Run it

It's static files — any web server works:

```
npx http-server -p 8642 .
```

Deploy by dragging the folder onto Netlify or pushing to GitHub Pages. No
build step, no backend, no runtime network dependency (flags are vendored in
`/flags`).

## Develop

- `npm test` — full suite (node:test, no dependencies)
- `node scripts/build-data.mjs` — rebuild `data/countries.json` (one-time,
  network)
- `node scripts/fetch-flags.mjs` — download any missing flag SVGs (one-time,
  network)
- `node scripts/verify-data.mjs` — dataset sanity checks

The pure logic (`js/scoring.js`, `js/normalise.js`, `js/puzzle.js`, the core
of `js/state.js`, `js/share.js`) is DOM-free and fully tested. UI lives in
`js/ui/`, orchestration in `js/main.js`.

## Dataset decisions

193 UN members + Vatican City + Palestine (displays Jerusalem). Excluded:
Kosovo, Taiwan, Western Sahara, Israel. Multi-capital countries accept every
legitimate capital and explain themselves in a `note` on reveal. Kyiv not
Kiev; Astana; Gitega; Naypyidaw; Jakarta (Nusantara accepted); Malabo
(Ciudad de la Paz accepted).
