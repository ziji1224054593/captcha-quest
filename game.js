import { createDefiance } from './defiance.js';
import { createBureau } from './bureau.js';
import { createCaptcha } from './vendor/captcha.js';
import { levels, createProgress } from './levels.js';

import { createTiming, formatTime } from './timing.js';
const clock = createTiming();
let clockInterval;
function renderTime() {
  $('levelTime').textContent = formatTime(clock.current);
  $('totalTime').textContent = formatTime(clock.total);
  const records = clock.records;
  levels.forEach((_, i) => {
    $(`stageTime${i + 1}`).textContent = records[i] !== undefined
      ? `用时 ${formatTime(records[i])}`
      : i === progress.state.level && progress.state.phase === 'playing'
        ? `计时 ${formatTime(clock.current)}`
        : '未开始';
  });
}
function startClock() { clearInterval(clockInterval); renderTime(); clockInterval = setInterval(renderTime, 100); }

const $ = id => document.getElementById(id);
const progress = createProgress();
let captcha, timer;
function mount() {
  clearTimeout(timer);
  captcha?.destroy();
  const { level } = progress.state;
  const current = levels[level];
  $('levelLabel').textContent = `LEVEL 0${level + 1} / 0${levels.length}`;
  $('levelTitle').textContent = current.title;
  $('instructions').textContent = current.instructions;
  document.body.classList.toggle('nightmare', !!current.options.nightmare);
  $('transition').hidden = true;
  $('victory').hidden = true;
  $('board').hidden = false;
  $('retry').disabled = false;
  $('status').textContent = current.options.bureau ? '' : level === 0 ? '准备好了就开始拖动，无需点击开始。' : `第 ${level + 1} 关已解锁。保持按住，坚持到最后一轮。`;
  $('failures').textContent = progress.state.failures;
  levels.forEach((_, i) => {
    const step = $(`step${i + 1}`);
    step.classList.toggle('done', i < level);
    if (i === level) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  });
  captcha = (current.options.defiance ? createDefiance : current.options.bureau ? createBureau : createCaptcha)('#captcha', {
    ...current.options,
    onChange({ changesCompleted }) { if (current.options.bureau || current.options.defiance) return; $('status').textContent = `已完成 ${changesCompleted} / ${current.options.changes + 1} 轮，继续按住，不要松手。`; },
    onFail() {
      progress.fail();
      $('failures').textContent = progress.state.failures;
      $('status').textContent = '差一点！点击“重试本关”再来，已解锁的关卡不会丢失。';
    },
    onSuccess() {
      if (!progress.win()) return;
      clock.finish();
      clearInterval(clockInterval);
      renderTime();
      $('retry').disabled = true;
      if (progress.state.phase === 'transition') {
        $('transition').hidden = false;
        $('transitionTitle').textContent = `第 ${level + 1} 关通过`;
        $('transitionText').textContent = `用时 ${formatTime(clock.current)} · 正在进入第 ${level + 2} 关…`;
        $('status').textContent = `第 ${level + 1} 关通过！即将自动进入第 ${level + 2} 关。`;
        timer = setTimeout(() => { if (progress.advance()) { clock.next(); mount(); } }, 1100);
      } else {
        $('board').hidden = true;
        $('victory').hidden = false;
        $('timeResults').replaceChildren(...clock.records.map((time, i) => {
          const row = document.createElement('p');
          row.textContent = `第 ${i + 1} 关 · ${levels[i].title}：${formatTime(time)}`;
          return row;
        }));
        $('finalTime').textContent = formatTime(clock.total);
        $('status').textContent = `全部通关！本次共失误 ${progress.state.failures} 次。`;
        $(`step${levels.length}`).classList.add('done');
        $(`step${levels.length}`).removeAttribute('aria-current');
        queueMicrotask(() => captcha?.destroy());
        $('playAgain').focus();
      }
    }
  });
  startClock();
}
function restart() { progress.restart(); clock.restart(); mount(); }
$('retry').addEventListener('click', () => { if (progress.state.phase === 'playing') mount(); });
$('restart').addEventListener('click', restart);
$('playAgain').addEventListener('click', restart);
window.addEventListener('pagehide', () => { clearTimeout(timer); clearInterval(clockInterval); captcha?.destroy(); });
window.addEventListener('pageshow', event => { if (event.persisted) restart(); });
mount();
