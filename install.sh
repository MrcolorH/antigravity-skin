#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$HOME/.gemini/config/plugins/antigravity-skin"
CONFIG_FILE="$HOME/.gemini/config/config.json"

echo "=================================================="
echo " 正在安装 Antigravity 主题与皮肤官方集成插件..."
echo "=================================================="

# 1. 确保插件目录存在
mkdir -p "$HOME/.gemini/config/plugins"

# 2. 创建软链接
if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
    echo "[1/3] 移除旧的插件链接/目录..."
    rm -rf "$TARGET_DIR"
fi

echo "[2/3] 链接插件至 $TARGET_DIR..."
ln -s "$PROJECT_DIR" "$TARGET_DIR"

# 3. 启用插件配置到 config.json
echo "[3/3] 在 ~/.gemini/config/config.json 中启用插件..."
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
"

echo "=================================================="
echo " [√] 安装成功！"
echo " 插件已挂载为 Antigravity 官方 Sidecar 伴生插件。"
echo " 请完全退出并重新打开 Antigravity 客户端即可生效！"
echo "=================================================="
