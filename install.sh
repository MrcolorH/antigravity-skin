#!/usr/bin/env bash
# Antigravity Skin - macOS / Linux 一键安装脚本
set -e

echo "=================================================="
echo "  正在安装 Antigravity 主题与皮肤插件..."
echo "=================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"

# 模式 A：本地已有解压文件且系统安装有 Node.js
if [ -n "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/scripts/install.mjs" ]; then
    if command -v node >/dev/null 2>&1; then
        node "$PROJECT_DIR/scripts/install.mjs"
        echo "提示：解压出来的临时源文件/文件夹现已可直接安全删除。"
        exit 0
    fi
fi

# 模式 B：通过管道远程一行命令执行 (curl ... | bash)，或者系统无 Node.js 环境
TARGET_DIR="$HOME/.gemini/config/plugins/antigravity-skin"
CONFIG_FILE="$HOME/.gemini/config/config.json"
PLUGINS_DIR="$HOME/.gemini/config/plugins"

mkdir -p "$PLUGINS_DIR"

SOURCE_ROOT="$PROJECT_DIR"
TEMP_CLEANUP=0
TEMP_ZIP="/tmp/antigravity-skin-latest.zip"
TEMP_EXTRACT="/tmp/antigravity-skin-extracted"

if [ -z "$SOURCE_ROOT" ] || [ ! -f "$SOURCE_ROOT/plugin.json" ]; then
    echo "[1/3] 检测到在线安装模式，正在下载最新 Release 安装包..."
    ZIP_URL="https://github.com/MrcolorH/antigravity-skin/releases/latest/download/antigravity-skin.zip"
    if ! curl -fsSL "$ZIP_URL" -o "$TEMP_ZIP" 2>/dev/null; then
        ZIP_URL="https://github.com/MrcolorH/antigravity-skin/archive/refs/heads/main.zip"
        curl -fsSL "$ZIP_URL" -o "$TEMP_ZIP"
    fi

    rm -rf "$TEMP_EXTRACT"
    mkdir -p "$TEMP_EXTRACT"
    unzip -q -o "$TEMP_ZIP" -d "$TEMP_EXTRACT"
    SOURCE_ROOT="$TEMP_EXTRACT"
    if [ ! -f "$SOURCE_ROOT/plugin.json" ]; then
        SUB_DIR=$(find "$TEMP_EXTRACT" -mindepth 1 -maxdepth 1 -type d | head -n 1)
        if [ -n "$SUB_DIR" ] && [ -f "$SUB_DIR/plugin.json" ]; then
            SOURCE_ROOT="$SUB_DIR"
        fi
    fi
    TEMP_CLEANUP=1
fi

cleanup() {
    if [ "$TEMP_CLEANUP" -eq 1 ]; then
        rm -f "$TEMP_ZIP" 2>/dev/null || true
        rm -rf "$TEMP_EXTRACT" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo "[2/3] 部署插件运行环境至 $TARGET_DIR..."

# 备份已有个性化配置
USER_CONFIG_BACKUP=""
if [ -f "$TARGET_DIR/config/config.json" ]; then
    USER_CONFIG_BACKUP=$(cat "$TARGET_DIR/config/config.json")
fi

mkdir -p "$TARGET_DIR"

# 实体文件拷贝（杜绝软链接，确保用户解压后删除源文件依然完好）
WHITELIST_DIRS=("client" "sidecars" "assets" "scripts")
WHITELIST_FILES=("plugin.json" "config.default.json" "package.json" "README.md" "install.bat" "uninstall.bat" "install.ps1" "uninstall.ps1" "install.sh" "uninstall.sh")

for d in "${WHITELIST_DIRS[@]}"; do
    if [ -d "$SOURCE_ROOT/$d" ]; then
        cp -R "$SOURCE_ROOT/$d" "$TARGET_DIR/"
    fi
done

for f in "${WHITELIST_FILES[@]}"; do
    if [ -f "$SOURCE_ROOT/$f" ]; then
        cp "$SOURCE_ROOT/$f" "$TARGET_DIR/"
    fi
done

mkdir -p "$TARGET_DIR/config"
if [ -n "$USER_CONFIG_BACKUP" ]; then
    echo "$USER_CONFIG_BACKUP" > "$TARGET_DIR/config/config.json"
elif [ ! -f "$TARGET_DIR/config/config.json" ] && [ -f "$TARGET_DIR/config.default.json" ]; then
    cp "$TARGET_DIR/config.default.json" "$TARGET_DIR/config/config.json"
fi

echo "[3/3] 注册并启用插件状态..."
python3 -c "
import json, os

config_file = os.path.expanduser('$CONFIG_FILE')
data = {}
if os.path.exists(config_file):
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        pass

plugins = data.setdefault('plugins', {})
plugins['antigravity-skin'] = {'enabled': True}

with open(config_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
" 2>/dev/null || true

echo "=================================================="
echo " [√] 安装部署完成！"
echo " 插件已部署至: $TARGET_DIR"
echo "--------------------------------------------------"
echo " 🔔 重要提示："
echo " 插件核心文件已全部复制到上述持久化目录。"
echo " 当前解压出来的安装包文件夹【已不需要，请直接删除】！"
echo " 本地无需保留任何多余文件，完全不影响插件正常运行。"
echo "--------------------------------------------------"
echo " 请完全退出并重新打开 Antigravity 客户端即可生效！"
echo "=================================================="
