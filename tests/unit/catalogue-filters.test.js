import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  applyFilters, cataloguePath, matchesQuery, parseFilters,
} from '../../public/js/core/catalogue-filters.js';

const products = [
  { id: 'a', name: 'PS 5 custom', priceCents: 75_000 },
  { id: 'b', name: 'Horizon forbidden west', priceCents: 4_999 },
  { id: 'c', name: 'PS 4', priceCents: 32_999 },
  { id: 'd', name: 'Xbox Series X', priceCents: 54_999 },
  { id: 'e', name: 'Manette', priceCents: 10_000 },
];
const names = (list) => list.map((p) => p.name);

describe('filtres du catalogue', () => {
  test('lecture de l’URL : valeurs inconnues ignorées', () => {
    assert.deepEqual(parseFilters(new URLSearchParams('q=%20ps%20&prix=100-500')), { q: 'ps', prix: '100-500' });
    assert.deepEqual(parseFilters(new URLSearchParams('prix=gratuit&tri=prix-asc')), { q: '', prix: null });
  });

  test('chemin : valeurs par défaut omises', () => {
    assert.equal(cataloguePath({}), '/');
    assert.equal(cataloguePath({ q: 'ps 5', prix: 'plus-500' }), '/?q=ps+5&prix=plus-500');
    assert.equal(cataloguePath({ q: '  ' }), '/');
  });

  test('recherche insensible à la casse, aux accents et aux espaces', () => {
    assert.ok(matchesQuery('PS 5 custom', 'ps5'));
    assert.ok(matchesQuery('PS 5 custom', 'Custom PS'));
    assert.ok(matchesQuery('Horizon forbidden west', 'HÖRIZON'));
    assert.ok(!matchesQuery('PS 4', 'xbox'));
  });

  test('tranches de prix (bornes 100 € et 500 € comprises dans la tranche du milieu)', () => {
    assert.deepEqual(names(applyFilters(products, { q: '', prix: 'moins-100' })), ['Horizon forbidden west']);
    assert.deepEqual(names(applyFilters(products, { q: '', prix: '100-500' })), ['Manette', 'PS 4']);
    assert.deepEqual(names(applyFilters(products, { q: '', prix: 'plus-500' })), ['PS 5 custom', 'Xbox Series X']);
  });

  test('classement par nom, sans modifier la liste d’origine', () => {
    const copy = [...products];
    assert.deepEqual(names(applyFilters(products, { q: '', prix: null })),
      ['Horizon forbidden west', 'Manette', 'PS 4', 'PS 5 custom', 'Xbox Series X']);
    assert.deepEqual(products, copy);
  });
});
