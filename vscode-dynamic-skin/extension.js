const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// 注入代码标记边界
const PATCH_START_TAG = '// --- VSCODE-DYNAMIC-SKIN-BEGIN ---';
const PATCH_END_TAG = '// --- VSCODE-DYNAMIC-SKIN-END ---';

// 支持的动态视频格式
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

/**
 * 获取 VS Code 主工作台核心入口 JS 路径
 */
function getWorkbenchJsPath() {
  const appRoot = vscode.env.appRoot;
  const candidate = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  // 备用兼容路径
  const altCandidate = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.main.js');
  if (fs.existsSync(altCandidate)) {
    return altCandidate;
  }
  throw new Error(`未找到 VS Code 核心文件，请检查当前版本路径: ${candidate}`);
}

/**
 * 转换文件系统路径为 VS Code 内部 vscode-file 协议安全 URL
 */
function toVsCodeFileUri(absolutePath) {
  let normalized = absolutePath.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return `vscode-file://vscode-app${encodeURI(normalized)}`;
}

/**
 * 扫描指定目录下的所有视频文件
 */
function scanVideosInDirectory(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const videos = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.includes(ext)) {
          videos.push({
            name: entry.name,
            fullPath: path.join(dirPath, entry.name)
          });
        }
      }
    }
    return videos;
  } catch (err) {
    vscode.window.showErrorMessage(`扫描视频目录失败: ${err.message}`);
    return [];
  }
}

/**
 * 生成注入到 VS Code 渲染主进程的 JS 源码
 */
function generateClientInjection(config, videoFullPath) {
  const videoUri = toVsCodeFileUri(videoFullPath);
  const opacity = typeof config.opacity === 'number' ? config.opacity : 0.85;
  const blur = typeof config.blur === 'number' ? config.blur : 5;
  const videoFit = config.videoFit || 'cover';
  const brightness = typeof config.brightness === 'number' ? config.brightness : 0.9;
  const contrast = typeof config.contrast === 'number' ? config.contrast : 1.0;
  const playbackRate = typeof config.playbackRate === 'number' ? config.playbackRate : 1.0;

  return `
${PATCH_START_TAG}
(function() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function initDynamicSkin() {
    try {
      const CONTAINER_ID = 'vscode-dynamic-skin-container';
      const VIDEO_ID = 'vscode-dynamic-skin-video';
      const STYLE_ID = 'vscode-dynamic-skin-styles';

      // 1. 确保或创建背景视频容器
      let container = document.getElementById(CONTAINER_ID);
      if (!container) {
        container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.style.cssText = [
          'position: fixed !important',
          'top: 0 !important',
          'left: 0 !important',
          'width: 100vw !important',
          'height: 100vh !important',
          'z-index: 0 !important',
          'pointer-events: none !important',
          'overflow: hidden !important',
          'margin: 0 !important',
          'padding: 0 !important'
        ].join(';');
        document.body.prepend(container);
      }

      // 2. 确保或创建 Video 标签
      let video = document.getElementById(VIDEO_ID);
      if (!video) {
        video = document.createElement('video');
        video.id = VIDEO_ID;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        container.appendChild(video);
      }

      video.style.cssText = [
        'width: 100% !important',
        'height: 100% !important',
        'object-fit: ${videoFit} !important',
        'display: block !important',
        'filter: brightness(${brightness}) contrast(${contrast}) !important',
        'transition: filter 0.3s ease !important'
      ].join(';');

      video.playbackRate = ${playbackRate};

      const targetSrc = "${videoUri}";
      if (video.getAttribute('data-skin-src') !== targetSrc) {
        video.setAttribute('data-skin-src', targetSrc);
        video.src = targetSrc;
        video.load();
        const playPromise = video.play();
        if (playPromise && playPromise.catch) {
          playPromise.catch(function(e) {
            console.warn('[DynamicSkin] 自动播放受限或媒体加载异常:', e);
          });
        }
      }

      // 3. 注入全套透明与毛玻璃样式
      let styleTag = document.getElementById(STYLE_ID);
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = STYLE_ID;
        document.head.appendChild(styleTag);
      }

      styleTag.textContent = \`
        /* 全局基础工作台背景彻底透明以透出底层视频 */
        .monaco-workbench {
          background-color: transparent !important;
          background-image: none !important;
        }

        /* 编辑器主体区域半透明与毛玻璃穿透 */
        .monaco-workbench .part.editor,
        .monaco-workbench .part.editor > .content,
        .monaco-workbench .part.editor .editor-group-container,
        .monaco-workbench .part.editor .editor-instance,
        .monaco-workbench .part.editor .monaco-editor,
        .monaco-workbench .part.editor .monaco-editor-background,
        .monaco-workbench .part.editor .inputarea.ime-input,
        .monaco-workbench .part.editor .monaco-editor .margin {
          background-color: rgba(30, 30, 30, ${opacity}) !important;
          backdrop-filter: blur(${blur}px) !important;
          -webkit-backdrop-filter: blur(${blur}px) !important;
        }

        /* 浅色模式适配 */
        .vs .monaco-workbench .part.editor,
        .vs .monaco-workbench .part.editor .editor-group-container,
        .vs .monaco-workbench .part.editor .monaco-editor,
        .vs .monaco-workbench .part.editor .monaco-editor-background {
          background-color: rgba(255, 255, 255, ${opacity}) !important;
        }

        /* 侧边栏微半透明与毛玻璃 */
        .monaco-workbench .part.sidebar {
          background-color: rgba(24, 24, 27, 0.72) !important;
          backdrop-filter: blur(${blur}px) !important;
          -webkit-backdrop-filter: blur(${blur}px) !important;
        }

        /* 活动栏 (Activity Bar) */
        .monaco-workbench .part.activitybar {
          background-color: rgba(18, 18, 20, 0.65) !important;
        }

        /* 底部控制台与终端面板 (Panel) */
        .monaco-workbench .part.panel {
          background-color: rgba(24, 24, 27, 0.75) !important;
          backdrop-filter: blur(${blur}px) !important;
          -webkit-backdrop-filter: blur(${blur}px) !important;
        }

        /* 顶部标题栏与菜单栏 */
        .monaco-workbench .part.titlebar {
          background-color: rgba(30, 30, 35, 0.65) !important;
        }

        /* 底部状态栏 */
        .monaco-workbench .part.statusbar {
          background-color: rgba(0, 122, 204, 0.55) !important;
        }

        /* 面板分割线及网格修饰 */
        .monaco-workbench .split-view-view {
          background-color: transparent !important;
        }
      \`;

      console.log('[DynamicSkin] 动态视频皮肤加载就绪: ${videoFullPath.replace(/\\/g, '\\\\')}');
    } catch (err) {
      console.error('[DynamicSkin] 渲染注入逻辑执行出错:', err);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initDynamicSkin();
  } else {
    window.addEventListener('DOMContentLoaded', initDynamicSkin);
  }
})();
${PATCH_END_TAG}
`;
}

/**
 * 将渲染代码写入 VS Code 核心文件
 */
function applyPatchToFile(codeToInject) {
  const targetPath = getWorkbenchJsPath();
  const backupPath = targetPath + '.bak';

  // 1. 如果没有备份，则先创建备份
  if (!fs.existsSync(backupPath)) {
    try {
      fs.copyFileSync(targetPath, backupPath);
    } catch (e) {
      console.warn('创建备份文件失败，跳过:', e.message);
    }
  }

  let content = fs.readFileSync(targetPath, 'utf8');

  // 2. 清理旧 patch
  const regex = new RegExp(`${escapeRegExp(PATCH_START_TAG)}[\\s\\S]*?${escapeRegExp(PATCH_END_TAG)}`, 'g');
  content = content.replace(regex, '').trim();

  // 3. 追加新 patch
  content += '\n' + codeToInject.trim() + '\n';

  try {
    fs.writeFileSync(targetPath, content, 'utf8');
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      const msg = process.platform === 'darwin'
        ? `权限不足，请在终端执行: sudo chown -R $(whoami) "${path.dirname(targetPath)}"`
        : `权限不足，请以管理员身份启动 VS Code 后重试。`;
      throw new Error(`${msg} (${err.message})`);
    }
    throw err;
  }
}

/**
 * 从 VS Code 核心文件中卸载动态皮肤
 */
function removePatchFromFile() {
  const targetPath = getWorkbenchJsPath();
  if (!fs.existsSync(targetPath)) return;

  let content = fs.readFileSync(targetPath, 'utf8');
  const regex = new RegExp(`${escapeRegExp(PATCH_START_TAG)}[\\s\\S]*?${escapeRegExp(PATCH_END_TAG)}`, 'g');

  if (!regex.test(content)) {
    return false; // 本来就没有注入
  }

  content = content.replace(regex, '').trim() + '\n';

  try {
    fs.writeFileSync(targetPath, content, 'utf8');
    return true;
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      const msg = process.platform === 'darwin'
        ? `权限不足，请在终端执行: sudo chown -R $(whoami) "${path.dirname(targetPath)}"`
        : `权限不足，请以管理员身份启动 VS Code 后重试。`;
      throw new Error(`${msg} (${err.message})`);
    }
    throw err;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 引导重新加载窗口
 */
async function promptReload(message) {
  const action = await vscode.window.showInformationMessage(message, '立即重载窗口 (Reload Window)', '稍后手动');
  if (action === '立即重载窗口 (Reload Window)') {
    vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

/**
 * 激活插件
 */
function activate(context) {
  console.log('VS Code Dynamic Skin 插件已激活！');

  // 命令 1：选择视频素材目录
  const chooseDirectoryCmd = vscode.commands.registerCommand('dynamicSkin.chooseDirectory', async () => {
    const config = vscode.workspace.getConfiguration('dynamicSkin');
    const defaultUri = config.get('directory') ? vscode.Uri.file(config.get('directory')) : undefined;

    const selectedUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: '选择此目录为视频皮肤库',
      defaultUri
    });

    if (!selectedUris || selectedUris.length === 0) return;

    const chosenPath = selectedUris[0].fsPath;
    await config.update('directory', chosenPath, vscode.ConfigurationTarget.Global);

    const videos = scanVideosInDirectory(chosenPath);
    if (videos.length === 0) {
      vscode.window.showWarningMessage(`已选择目录 [${chosenPath}]，但该目录下暂未检测到支持的视频文件 (.mp4, .webm, .ogg, .mov)。`);
      return;
    }

    // 默认选用第一个视频并询问是否立即应用
    await config.update('currentVideo', videos[0].name, vscode.ConfigurationTarget.Global);
    const applyNow = await vscode.window.showInformationMessage(
      `已载入目录 [${chosenPath}]，共发现 ${videos.length} 个视频素材。当前选中: ${videos[0].name}`,
      '立即应用并渲染',
      '稍后手动应用'
    );

    if (applyNow === '立即应用并渲染') {
      vscode.commands.executeCommand('dynamicSkin.apply');
    }
  });

  // 命令 2：选择具体播放视频
  const selectVideoCmd = vscode.commands.registerCommand('dynamicSkin.selectVideo', async () => {
    const config = vscode.workspace.getConfiguration('dynamicSkin');
    const directory = config.get('directory');

    if (!directory || !fs.existsSync(directory)) {
      const choose = await vscode.window.showWarningMessage('当前尚未配置有效的视频素材目录！', '去选择目录');
      if (choose === '去选择目录') {
        vscode.commands.executeCommand('dynamicSkin.chooseDirectory');
      }
      return;
    }

    const videos = scanVideosInDirectory(directory);
    if (videos.length === 0) {
      vscode.window.showWarningMessage(`目录 [${directory}] 下未发现支持的视频文件。`);
      return;
    }

    const currentVideo = config.get('currentVideo');
    const items = videos.map(v => ({
      label: v.name === currentVideo ? `✓ ${v.name} (当前生效)` : v.name,
      description: v.fullPath,
      fileName: v.name,
      fullPath: v.fullPath
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: '请选择要播放的背景视频素材'
    });

    if (!picked) return;

    await config.update('currentVideo', picked.fileName, vscode.ConfigurationTarget.Global);
    const applyNow = await vscode.window.showInformationMessage(
      `已切换为视频: ${picked.fileName}`,
      '立即更新渲染',
      '稍后'
    );

    if (applyNow === '立即更新渲染') {
      vscode.commands.executeCommand('dynamicSkin.apply');
    }
  });

  // 命令 3：应用/更新渲染
  const applyCmd = vscode.commands.registerCommand('dynamicSkin.apply', async () => {
    try {
      const config = vscode.workspace.getConfiguration('dynamicSkin');
      let directory = config.get('directory');

      if (!directory || !fs.existsSync(directory)) {
        const choose = await vscode.window.showWarningMessage('尚未指定视频素材目录，请先选择！', '选择目录');
        if (choose === '选择目录') {
          vscode.commands.executeCommand('dynamicSkin.chooseDirectory');
        }
        return;
      }

      const videos = scanVideosInDirectory(directory);
      if (videos.length === 0) {
        vscode.window.showErrorMessage(`素材目录中未找到支持的视频文件 (.mp4, .webm, .ogg, .mov)。`);
        return;
      }

      let currentVideoName = config.get('currentVideo');
      let targetVideo = videos.find(v => v.name === currentVideoName);
      if (!targetVideo) {
        targetVideo = videos[0];
        await config.update('currentVideo', targetVideo.name, vscode.ConfigurationTarget.Global);
      }

      const patchCode = generateClientInjection({
        opacity: config.get('opacity'),
        blur: config.get('blur'),
        videoFit: config.get('videoFit'),
        brightness: config.get('brightness'),
        contrast: config.get('contrast'),
        playbackRate: config.get('playbackRate')
      }, targetVideo.fullPath);

      applyPatchToFile(patchCode);

      promptReload(`✨ 动态视频皮肤 [${targetVideo.name}] 已成功应用！请重新加载窗口生效。`);
    } catch (err) {
      vscode.window.showErrorMessage(`应用动态皮肤失败: ${err.message}`);
    }
  });

  // 命令 4：卸载并恢复原生界面
  const removeCmd = vscode.commands.registerCommand('dynamicSkin.remove', async () => {
    try {
      const removed = removePatchFromFile();
      if (removed) {
        promptReload('🧹 动态视频皮肤已彻底移除，界面已恢复为官方原生样式！');
      } else {
        vscode.window.showInformationMessage('当前未检测到已注入的动态皮肤代码，无需恢复。');
      }
    } catch (err) {
      vscode.window.showErrorMessage(`移除动态皮肤失败: ${err.message}`);
    }
  });

  // 命令 5：打开设置
  const openConfigCmd = vscode.commands.registerCommand('dynamicSkin.openConfig', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'dynamicSkin');
  });

  context.subscriptions.push(chooseDirectoryCmd, selectVideoCmd, applyCmd, removeCmd, openConfigCmd);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
