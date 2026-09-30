import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, levels } from './levels.js';

test('first victory unlocks second level once; third victory completes game', () => {
  const game = createProgress();
  game.fail();
  assert.equal(game.win(), true);
  assert.equal(game.win(), false);
  assert.equal(game.state.phase, 'transition');
  assert.equal(game.advance(), true);
  assert.equal(game.advance(), false);
  assert.deepEqual(game.state, { level: 1, failures: 1, phase: 'playing' });
  game.fail();
  game.win();
  assert.equal(game.state.phase, 'transition');
  game.advance();
  game.win();
  game.fail();
  assert.deepEqual(game.state, { level: 2, failures: 2, phase: 'complete' });
});
test('restart during transition cancels advancement and resets score', () => {
  const game = createProgress();
  game.fail(); game.win(); game.restart();
  assert.equal(game.advance(), false);
  assert.deepEqual(game.state, { level: 0, failures: 0, phase: 'playing' });
});
test('intro has one target and no transformation; final level enables all effects', () => {
  assert.equal(levels[0].options.singleTarget, true);
  assert.equal(levels[0].options.changes, 0);
  assert.equal(levels[1].options.changes, 2);
  assert.equal(Object.values(levels[1].options.effects).filter(Boolean).length, 8);
});
