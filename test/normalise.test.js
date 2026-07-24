import test from 'node:test';
import assert from 'node:assert/strict';
import { normalise, levenshtein } from '../js/normalise.js';

test('diacritics strip to plain letters', () => {
  assert.equal(normalise('Bogotá'), normalise('BOGOTA'));
  assert.equal(normalise('Reykjavík'), 'REYKJAVIK');
  assert.equal(normalise('Asunción'), 'ASUNCION');
  assert.equal(normalise('São Tomé'), 'SAO TOME');
});

test('apostrophes vanish', () => {
  assert.equal(normalise("N'Djamena"), normalise('NDJAMENA'));
  assert.equal(normalise('Nuku’alofa'), 'NUKUALOFA');
});

test('hyphens become spaces', () => {
  assert.equal(normalise('Port-au-Prince'), normalise('PORT AU PRINCE'));
});

test('periods and commas vanish', () => {
  assert.equal(normalise('Washington, D.C.'), 'WASHINGTON DC');
});

test('whitespace runs collapse and trim', () => {
  assert.equal(normalise('  Addis   Ababa '), 'ADDIS ABABA');
});

test('display form is untouched — normalise is a comparison key, not a mutation', () => {
  const display = 'São Tomé';
  normalise(display);
  assert.equal(display, 'São Tomé');
});

test('levenshtein', () => {
  assert.equal(levenshtein('ROME', 'ROME'), 0);
  assert.equal(levenshtein('ROME', 'ROMA'), 1);
  assert.equal(levenshtein('REYKJAVIK', 'REYKAVIK'), 1); // dropped letter
  assert.equal(levenshtein('KITTEN', 'SITTING'), 3);
  assert.equal(levenshtein('', 'ABC'), 3);
  assert.equal(levenshtein('AB', 'BA'), 2);
});
