#!/bin/bash
set -e

TARGET_DIR="$HOME/.gemini/config/plugins/antigravity-skin"
CONFIG_FILE="$HOME/.gemini/config/config.json"

echo "=================================================="
echo " 正在卸载 Antigravity 主题与皮肤插件..."
echo "=================================================="

# 1. 移除软链接
if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
    echo "[1/2] 正在清理插件链接 $TARGET_DIR..."
    rm -rf "$TARGET_DIR"
fi

# 2. 从 config.json 中停用或移除
echo "[2/2] 正在更新配置 ~/.gemini/config/config.json..."
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
echo " [√] 卸载完成！重启客户端后将完全恢复原生界面。"
echo "=================================================="
