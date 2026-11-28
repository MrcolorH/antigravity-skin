#!/usr/bin/env bash
# Antigravity Skin - macOS / Linux 一键卸载脚本
set -e

echo "=================================================="
echo "  正在卸载 Antigravity 主题与皮肤插件..."
echo "=================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"

if [ -n "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/scripts/uninstall.mjs" ]; then
    if command -v node >/dev/null 2>&1; then
        node "$PROJECT_DIR/scripts/uninstall.mjs" "$@"
        exit 0
    fi
fi

TARGET_DIR="$HOME/.gemini/config/plugins/antigravity-skin"
CONFIG_FILE="$HOME/.gemini/config/config.json"

echo "[1/3] 恢复官方纯净安装入口与原版备份..."
if [ "$(uname -s)" = "Darwin" ]; then
    ISOLATED_APP="$HOME/Library/Application Support/AntigravitySkin.noindex/Antigravity.app"
    SYSTEM_APP="/Applications/Antigravity.app"
    USER_APP="$HOME/Applications/Antigravity.app"
    KEEP_LAUNCHER="$HOME/Applications/Antigravity Skin.app"
    LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

    # 若历史版本打过可选内核补丁，先在后台原位置恢复 app.asar.bak（不拉起客户端）
    for res_dir in "$ISOLATED_APP/Contents/Resources" "$SYSTEM_APP/Contents/Resources" "$USER_APP/Contents/Resources"; do
        if [ -f "$res_dir/app.asar.bak" ]; then
            cp -f "$res_dir/app.asar.bak" "$res_dir/app.asar" 2>/dev/null || true
        fi
    done

    # 若存在启动器，严格校验 Bundle Identifier 后清理并将真实应用归位到 /Applications/Antigravity.app
    if [ -d "$SYSTEM_APP" ] && [ -f "$SYSTEM_APP/Contents/Info.plist" ] && grep -q "com.antigravity-skin.launcher" "$SYSTEM_APP/Contents/Info.plist" 2>/dev/null; then
        if [ -d "$ISOLATED_APP" ]; then
            rm -rf "$SYSTEM_APP" 2>/dev/null || true
            mv "$ISOLATED_APP" "$SYSTEM_APP" 2>/dev/null || true
            if [ -x "$LSREGISTER" ]; then
                "$LSREGISTER" -f "$SYSTEM_APP" >/dev/null 2>&1 || true
            fi
        fi
    fi

    if [ -d "$KEEP_LAUNCHER" ] && [ -f "$KEEP_LAUNCHER/Contents/Info.plist" ] && grep -q "com.antigravity-skin.launcher" "$KEEP_LAUNCHER/Contents/Info.plist" 2>/dev/null; then
        rm -rf "$KEEP_LAUNCHER" 2>/dev/null || true
    fi
fi

if [ -f "$HOME/.local/bin/antigravity" ] && grep -q "antigravity-skin" "$HOME/.local/bin/antigravity" 2>/dev/null; then
    rm -f "$HOME/.local/bin/antigravity" 2>/dev/null || true
fi

if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
    echo "[2/3] 移除插件部署目录..."
    rm -rf "$TARGET_DIR"
fi

echo "[3/3] 从配置文件注销插件..."
python3 -c "
import json, os

config_file = os.path.expanduser('$CONFIG_FILE')
if os.path.exists(config_file):
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if 'plugins' in data and 'antigravity-skin' in data['plugins']:
            del data['plugins']['antigravity-skin']
            tmp_file = f'{config_file}.tmp.{os.getpid()}'
            with open(tmp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_file, config_file)
    except Exception:
        pass
" 2>/dev/null || true

echo "=================================================="
echo " [√] 卸载成功！已完全还原官方初始状态。"
echo " 请完全退出并重新打开 Antigravity 客户端。"
echo "=================================================="
