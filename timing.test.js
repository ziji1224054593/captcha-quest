import test from 'node:test';
import assert from 'node:assert/strict';
import { createTiming, formatTime } from './timing.js';

test('records levels, excludes transitions and freezes completion', () => {
  let now = 0;
  const clock = createTiming(() => now);
  now = 1234;
  assert.equal(clock.current, 1234);
  clock.finish(); clock.finish();
  now = 2334;
  assert.equal(clock.total, 1234);
  clock.next(); now = 5000; clock.finish();
  assert.deepEqual(clock.records, [1234, 2666]);
  assert.equal(clock.total, 3900);
  now = 9000;
  assert.equal(clock.total, 3900);
  clock.restart();
  assert.equal(clock.total, 0);
  assert.deepEqual(clock.records, []);
});
test('formats tenths and long runs without wrapping minutes', () => {
  assert.equal(formatTime(0), '00:00.0');
  assert.equal(formatTime(61999), '01:01.9');
  assert.equal(formatTime(3600000), '60:00.0');
});
