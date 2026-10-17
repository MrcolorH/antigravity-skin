/**
 * default-boot.js - Antigravity Official High-Tech Geek Boot Animation
 * 
 * Provides an immersive, lightweight, zero-dependency Canvas & DOM boot intro.
 * Smoothly auto-closes after initialization or on ESC / click.
 */

(function(global) {
  function runBootAnimation(container, close) {
    let isTerminated = false;
    let animId = null;
    let autoCloseTimer = null;

    // 创建主画布
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // 粒子系统
    const PARTICLE_COUNT = 70;
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.6 + 0.2
      });
    }

    // UI DOM 层
    const ui = document.createElement('div');
    ui.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      pointer-events: none;
      user-select: none;
    `;
    ui.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:18px;">
        <div style="width:72px;height:72px;position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border:2px solid rgba(56,189,248,0.25);border-radius:50%;border-top-color:#38bdf8;animation:agy-spin 1.8s linear infinite;"></div>
          <div style="position:absolute;inset:7px;border:1.5px dashed rgba(14,165,233,0.45);border-radius:50%;border-bottom-color:#38bdf8;animation:agy-spin-reverse 3s linear infinite;"></div>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 10px rgba(56,189,248,0.7));">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>

        <div style="text-align:center;">
          <div style="font-size:22px;font-weight:700;letter-spacing:4px;color:#f8fafc;text-transform:uppercase;text-shadow:0 0 16px rgba(56,189,248,0.5);">
            ANTIGRAVITY
          </div>
          <div style="font-size:11px;font-weight:500;letter-spacing:2px;color:rgba(148,163,184,0.85);margin-top:4px;">
            AI ASSISTED AGENTIC ENVIRONMENT
          </div>
        </div>

        <div style="width:260px;margin-top:12px;display:flex;flex-direction:column;gap:7px;">
          <div style="height:3px;width:100%;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.4);">
            <div id="agy-boot-prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg, #0284c7, #38bdf8);border-radius:3px;box-shadow:0 0 10px #38bdf8;transition:width 0.1s linear;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;font-family:monospace;">
            <span id="agy-boot-prog-status">INITIALIZING WORKSPACE...</span>
            <span id="agy-boot-prog-num" style="color:#38bdf8;font-weight:600;">0%</span>
          </div>
        </div>
      </div>
    `;

    // 注入内置 CSS 动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes agy-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes agy-spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
    `;
    ui.appendChild(style);
    container.appendChild(ui);

    const progressBar = ui.querySelector('#agy-boot-prog-bar');
    const progressStatus = ui.querySelector('#agy-boot-prog-status');
    const progressNum = ui.querySelector('#agy-boot-prog-num');

    // 启动动画时间线
    const startTime = Date.now();
    const DURATION = 2400; // 2.4 秒平滑过渡

    const statusList = [
      { t: 0.1, msg: 'INITIALIZING ENGINE...' },
      { t: 0.35, msg: 'LOADING AGENTIC MODULES...' },
      { t: 0.65, msg: 'SYNCING RUNTIME SETTINGS...' },
      { t: 0.9, msg: 'SYSTEM READY.' }
    ];

    function draw() {
      if (isTerminated) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / DURATION);

      // 背景微光渐变
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, width, height);

      // 中心光晕
      const grad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width * 0.45);
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.12)');
      grad.addColorStop(0.6, 'rgba(2, 132, 199, 0.03)');
      grad.addColorStop(1, 'rgba(5, 8, 17, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 粒子连线与更新
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - dist / 110) * 0.12})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // 更新进度
      const pct = Math.floor(progress * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressNum) progressNum.textContent = `${pct}%`;

      const currStatus = statusList.slice().reverse().find(s => progress >= s.t);
      if (currStatus && progressStatus && progressStatus.textContent !== currStatus.msg) {
        progressStatus.textContent = currStatus.msg;
      }

      if (progress < 1) {
        animId = requestAnimationFrame(draw);
      } else {
        autoCloseTimer = setTimeout(() => {
          cleanup();
          if (typeof close === 'function') close();
        }, 220);
      }
    }

    animId = requestAnimationFrame(draw);

    function cleanup() {
      if (isTerminated) return;
      isTerminated = true;
      if (animId) cancelAnimationFrame(animId);
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      window.removeEventListener('resize', onResize);
    }

    return cleanup;
  }

  // 挂载到全局，同时支持 commonjs/esm exports
  if (typeof window !== 'undefined') {
    window.__customBootAnimation = runBootAnimation;
  }
  if (typeof exports !== 'undefined') {
    exports.run = runBootAnimation;
  }
  return runBootAnimation;
})(typeof window !== 'undefined' ? window : globalThis);
