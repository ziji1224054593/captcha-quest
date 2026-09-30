export const levels = [
  {
    title: '初来乍到',
    instructions: '按住拼块，拖入唯一的缺口，对齐后松手。一次匹配即可过关。',
    options: { width: 560, changes: 0, singleTarget: true, textureInterval: 0, noise: { dots: 0 }, cracks: { count: 0 } }
  },
  {
    title: '极限验证',
    instructions: '全程按住，连续完成三轮匹配。滚轮 / 方向键调整拼块角度，找对纹理、绕开障碍并跟随目标；外环出现后绕圆心拖动对齐。最后提示完成时再松手。手机用另一根手指点击旋转按钮。',
    options: { width: 560, changes: 2, colorMotion: true, textureInterval: 800, followDuration: 500, effects: { textureMatch: true, rotation: true, spotlight: true, movingTargets: true, temporalClues: true, obstacles: true, ripples: true, outerRing: true } }
  },
  {
    title: '反人类审查局',
    instructions: '终极规则：反向拖动（双倍位移），外环也反向！拼块远离目标时每 1.6 秒自行转动 45°，进入目标附近 90 像素范围后停止自转。更快的目标需连续贴合 1.2 秒，完成五轮变形与外环衔接才能松手。失败只重试本关。',
    options: { width: 560, changes: 4, nightmare: true, tolerance: 10, colorMotion: true, colorSpeed: 4, textureInterval: 400, followDuration: 1200, noise: { dots: 600, opacity: 0.24 }, cracks: { count: 14, opacity: 0.28 }, effects: { textureMatch: true, rotation: true, spotlight: true, movingTargets: true, temporalClues: true, obstacles: true, ripples: true, outerRing: true } }
  }
];

export function createProgress() {
  let level = 0, failures = 0, phase = 'playing';
  return {
    get state() { return { level, failures, phase }; },
    fail() { if (phase === 'playing') failures++; },
    win() { if (phase !== 'playing') return false; phase = level < levels.length - 1 ? 'transition' : 'complete'; return true; },
    advance() { if (phase !== 'transition') return false; level++; phase = 'playing'; return true; },
    restart() { level = 0; failures = 0; phase = 'playing'; }
  };
}
