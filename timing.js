export function formatTime(ms) {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return String(Math.floor(tenths / 600)).padStart(2, '0') + ':' + String(Math.floor(tenths / 10) % 60).padStart(2, '0') + '.' + tenths % 10;
}
export function createTiming(now = () => performance.now()) {
  let records = [], start = now(), running = true;
  return {
    get records() { return [...records]; },
    get current() { return running ? now() - start : records.at(-1) ?? 0; },
    get total() { return records.reduce((a, b) => a + b, 0) + (running ? now() - start : 0); },
    finish() { if (running) { records.push(now() - start); running = false; } },
    next() { if (!running) { start = now(); running = true; } },
    restart() { records = []; start = now(); running = true; }
  };
}
