#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 优先使用统一规范的 Node.js 卸载引擎
if command -v node >/dev/null 2>&1; then
    node "$PROJECT_DIR/scripts/uninstall.mjs"
    exit 0
fi

# 回退机制：系统无 node 运行时
TARGET_DIR="$HOME/.gemini/config/plugins/antigravity-skin"
CONFIG_FILE="$HOME/.gemini/config/config.json"

echo "=================================================="
echo " 正在卸载 Antigravity 主题与皮肤官方集成插件..."
echo "=================================================="

if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
    echo "[1/2] 移除插件目录/链接..."
    rm -rf "$TARGET_DIR"
fi

echo "[2/2] 从 ~/.gemini/config/config.json 中移除插件..."
python3 -c "
import json, os

config_file = os.path.expanduser('$CONFIG_FILE')
if os.path.exists(config_file):
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if 'plugins' in data and 'antigravity-skin' in data['plugins']:
            del data['plugins']['antigravity-skin']
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
"

echo "=================================================="
echo " [√] 卸载完成！重启客户端即可完全恢复官方原生状态。"
echo "=================================================="
