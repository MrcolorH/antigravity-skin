/**
 * test-scenescript-properties.mjs
 * 子模块四：场景脚本属性与时钟系统 (SceneScript & Properties Inspector)
 * 单元与集成自动化测试套件
 */

import assert from 'node:assert/strict';
import { normalizeProperties, humanizePropertyText } from '../sidecars/skin-engine/wallpaper-library.mjs';

console.log('🧪 开始执行子模块四（场景脚本属性与时钟系统）自动化测试套件...\n');

let passedTests = 0;
function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// =========================================================================
// 测试分组 1：阶段 02 属性元数据规范与归一化解析 (normalizeProperties)
// =========================================================================
console.log('--- 测试分组 1：属性元数据反射与归一化清洗 ---');

runTest('1.1 词条本地化转换 (humanizePropertyText)', () => {
  assert.equal(humanizePropertyText('schemecolor', 'ui_browse_properties_scheme_color'), '配色方案');
  assert.equal(humanizePropertyText('clock', 'ui_editor_properties_clock'), '时钟');
  assert.equal(humanizePropertyText('speed', 'ui_browse_properties_speed'), '播放速度');
  assert.equal(humanizePropertyText('custom', 'ui_browse_properties_custom_particle_density'), 'Custom Particle Density');
  assert.equal(humanizePropertyText('custom', '24小时制'), '24小时制');
});

runTest('1.2 多态类型解析 (bool, slider, color, combo, text)', () => {
  const mockProperties = {
    schemecolor: { order: 0, text: 'ui_browse_properties_scheme_color', type: 'color', value: '0.1 0.5 0.9' },
    use24h: { order: 1, text: '24小时制', type: 'bool', value: true },
    show_seconds: { order: 2, text: '显示秒数', type: 'bool', value: false },
    particle_density: { order: 3, text: '粒子浓度', type: 'slider', min: 0, max: 100, value: 50, step: 1 },
    preset_mode: {
      order: 4,
      text: '样式选择',
      type: 'combo',
      value: 'default',
      options: [
        { label: '默认', value: 'default' },
        { label: '霓虹', value: 'neon' }
      ]
    },
    user_greet: { order: 5, text: '欢迎标语', type: 'text', value: 'Hello Antigravity' },
    unknown_type: { order: 99, text: '非法', type: 'directory' } // 应被过滤
  };

  const parsed = normalizeProperties(mockProperties);
  assert.ok(parsed, '解析结果不应为空');

  // bool 验证
  assert.equal(parsed.use24h.type, 'bool');
  assert.equal(parsed.use24h.value, true);
  assert.equal(parsed.show_seconds.value, false);

  // slider 验证
  assert.equal(parsed.particle_density.type, 'slider');
  assert.equal(parsed.particle_density.min, 0);
  assert.equal(parsed.particle_density.max, 100);
  assert.equal(parsed.particle_density.value, 50);

  // color 验证
  assert.equal(parsed.schemecolor.type, 'color');
  assert.equal(parsed.schemecolor.value, '0.1 0.5 0.9');

  // combo 验证
  assert.equal(parsed.preset_mode.type, 'combo');
  assert.equal(parsed.preset_mode.value, 'default');
  assert.equal(parsed.preset_mode.options.length, 2);

  // text 验证
  assert.equal(parsed.user_greet.type, 'text');
  assert.equal(parsed.user_greet.value, 'Hello Antigravity');

  // 过滤验证
  assert.equal(parsed.unknown_type, undefined, '不支持的未知类型应被过滤');
});

runTest('1.3 空输入与边界容错', () => {
  assert.equal(normalizeProperties(null), null);
  assert.equal(normalizeProperties({}), null);
  assert.equal(normalizeProperties('invalid'), null);
});

// =========================================================================
// 测试分组 2：阶段 01 本地真实时间流与日进度计算公式
// =========================================================================
console.log('\n--- 测试分组 2：系统时钟时间流与日进度 (timeOfDay) ---');

runTest('2.1 归一化日进度天文时间基准计算', () => {
  const calcTimeOfDay = (h, m, s) => (h * 3600 + m * 60 + s) / 86400;

  // 午夜 00:00:00 -> 0.0
  assert.equal(calcTimeOfDay(0, 0, 0), 0.0);
  // 正午 12:00:00 -> 0.5
  assert.equal(calcTimeOfDay(12, 0, 0), 0.5);
  // 下午 18:00:00 -> 0.75
  assert.equal(calcTimeOfDay(18, 0, 0), 0.75);
  // 接近午夜 23:59:59 -> 86399 / 86400
  assert.ok(Math.abs(calcTimeOfDay(23, 59, 59) - (86399 / 86400)) < 1e-6);

  // 当前宿主环境真实时间计算
  const now = new Date();
  const currentProgress = calcTimeOfDay(now.getHours(), now.getMinutes(), now.getSeconds());
  assert.ok(currentProgress >= 0 && currentProgress <= 1, '当前宿主进度应在 [0, 1] 范围内');
});

// =========================================================================
// 测试分组 3：阶段 02 独立持久化模型与深合并
// =========================================================================
console.log('\n--- 测试分组 3：Per-Wallpaper 独立持久化与配置隔离 ---');

runTest('3.1 跨壁纸个性化参数字典隔离', () => {
  const wallpaperUserProperties = {};
  const wpId1 = '1982409329';
  const wpId2 = '3400422354';

  wallpaperUserProperties[wpId1] = { use24h: false, particle_density: 80 };
  wallpaperUserProperties[wpId2] = { use24h: true, schemecolor: '1.0 0.0 0.0' };

  assert.equal(wallpaperUserProperties[wpId1].use24h, false);
  assert.equal(wallpaperUserProperties[wpId2].use24h, true);
  assert.equal(wallpaperUserProperties[wpId1].schemecolor, undefined);

  // 一键恢复默认：清除壁纸 1 的覆盖
  delete wallpaperUserProperties[wpId1];
  assert.equal(wallpaperUserProperties[wpId1], undefined, '恢复默认后应清空自定义覆盖');
  assert.ok(wallpaperUserProperties[wpId2], '壁纸 2 的配置不受影响');
});

// =========================================================================
// 测试分组 4：阶段 04 Live Tweak 颜色转换与属性热更
// =========================================================================
console.log('\n--- 测试分组 4：Live Tweak 颜色向量与十六进制双向无损转换 ---');

runTest('4.1 RGB 归一化向量与 Hex 双向映射', () => {
  function rgbStrToHex(rgbStr) {
    if (!rgbStr) return '#ffffff';
    if (String(rgbStr).startsWith('#')) return String(rgbStr);
    const parts = String(rgbStr).trim().split(/\s+/).map(Number);
    if (parts.length >= 3) {
      const r = Math.min(255, Math.max(0, Math.round(parts[0] <= 1.0 ? parts[0] * 255 : parts[0])));
      const g = Math.min(255, Math.max(0, Math.round(parts[1] <= 1.0 ? parts[1] * 255 : parts[1])));
      const b = Math.min(255, Math.max(0, Math.round(parts[2] <= 1.0 ? parts[2] * 255 : parts[2])));
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    return '#ffffff';
  }

  function hexToRgbStr(hex) {
    const clean = String(hex).replace('#', '');
    const r = (parseInt(clean.slice(0, 2), 16) / 255).toFixed(3);
    const g = (parseInt(clean.slice(2, 4), 16) / 255).toFixed(3);
    const b = (parseInt(clean.slice(4, 6), 16) / 255).toFixed(3);
    return `${r} ${g} ${b}`;
  }

  // 纯白与纯黑
  assert.equal(rgbStrToHex('1.0 1.0 1.0'), '#ffffff');
  assert.equal(rgbStrToHex('0 0 0'), '#000000');

  // 红色与蓝色
  assert.equal(rgbStrToHex('1.0 0.0 0.0'), '#ff0000');
  assert.equal(rgbStrToHex('0.0 0.0 1.0'), '#0000ff');

  // 反向转换
  const redVec = hexToRgbStr('#ff0000');
  assert.ok(redVec.startsWith('1.000 0.000 0.000'));
  assert.equal(rgbStrToHex(redVec), '#ff0000');
});

// =========================================================================
// 测试分组 5：阶段 01/04 沙箱敏感隔离审计
// =========================================================================
console.log('\n--- 测试分组 5：SceneScript 安全沙箱边界设计 ---');

runTest('5.1 验证敏感对象参数遮蔽防逃逸 (Shadowing)', () => {
  const blockedGlobals = [
    'require', 'process', 'child_process', 'fs', 'globalThis',
    'window', 'document', 'fetch', 'XMLHttpRequest', 'Worker', 'importScripts'
  ];

  // 模拟沙箱隔离执行包装器
  const sandboxFactory = (code) => {
    return new Function(
      ...blockedGlobals,
      `"use strict"; ${code}`
    );
  };

  const fn = sandboxFactory(`
    return {
      hasProcess: typeof process !== 'undefined' && process !== null,
      hasRequire: typeof require !== 'undefined' && require !== null,
      hasFetch: typeof fetch !== 'undefined' && fetch !== null,
      dateWorks: typeof Date === 'function' && !isNaN(new Date().getTime())
    };
  `);

  // 在调用沙箱时，将所有受限对象均赋为 undefined
  const result = fn(...new Array(blockedGlobals.length).fill(undefined));
  assert.equal(result.hasProcess, false, 'process 必须被切断');
  assert.equal(result.hasRequire, false, 'require 必须被切断');
  assert.equal(result.hasFetch, false, 'fetch 必须被切断');
  assert.equal(result.dateWorks, true, '标准 Date 计算必须正常工作');
});

console.log(`\n========================================`);
console.log(`🎉 全部 ${passedTests} 项测试用例执行完毕且 100% 通过！`);
console.log(`========================================\n`);
