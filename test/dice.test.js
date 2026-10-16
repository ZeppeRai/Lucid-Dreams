import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDice, tally, verdict } from '../src/dice.js';

test('rollDice gera d6 válidos', () => {
  const d = rollDice(500);
  assert.equal(d.length, 500);
  assert.ok(d.every(v => v >= 1 && v <= 6));
});

test('rollDice mapeia o rng para 1..6', () => {
  assert.deepEqual(rollDice(6, () => [0, 1, 2, 3, 4, 5]), [1, 2, 3, 4, 5, 6]);
});

test('tally: 5 e 6 são sucesso, 1 é tropeço, PR soma sucesso automático', () => {
  assert.deepEqual(tally([1, 2, 5, 6, 6, 1]), { successes: 3, stumbles: 2 });
  assert.deepEqual(tally([2, 3], 2), { successes: 2, stumbles: 0 });
});

test('verdict', () => {
  assert.equal(verdict(2, 2), 'Sucesso');
  assert.equal(verdict(1, 2), 'Falha');
  assert.equal(verdict(5, null), null);
});
