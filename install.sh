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

IS_INSIDE_HOST=0
if [ -n "$ANTIGRAVITY_LS_ADDRESS" ] || [ -n "$ANTIGRAVITY_CSRF_TOKEN" ]; then
    IS_INSIDE_HOST=1
fi

# 模式 B：通过管道远程一行命令执行 (curl ... | bash)，或者系统无 Node.js 环境
if [ "$IS_INSIDE_HOST" -eq 1 ]; then
    echo "💡 检测到当前正运行于 Antigravity 宿主环境/内置终端中，跳过强制退出以防止中断当前会话。"
elif pgrep -i antigravity >/dev/null 2>&1 || pgrep -f "language_server.*antigravity" >/dev/null 2>&1; then
    echo "⚠️ 检测到 Antigravity 客户端或后台语言服务正在运行，正在执行安全优雅退出..."
    if [ "$(uname -s)" = "Darwin" ]; then
        osascript -e 'tell application id "com.google.antigravity" to quit' 2>/dev/null || true
    fi
    COUNT=0
    while [ $COUNT -lt 25 ]; do
        if ! pgrep -i antigravity >/dev/null 2>&1 && ! pgrep -f "language_server.*antigravity" >/dev/null 2>&1; then
            break
        fi
        sleep 0.2
        COUNT=$((COUNT + 1))
    done
    pkill -i antigravity 2>/dev/null || true
    pkill -f "language_server.*antigravity" 2>/dev/null || true
    sleep 0.5
    echo "     ✅ Antigravity 客户端及后台语言服务已安全就绪。"
fi

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

# 存量 antigravity-pulse 无损迁移与清理（回退分支）
PULSE_DIR="$PLUGINS_DIR/antigravity-pulse"
PULSE_DATA="$HOME/.gemini/antigravity/sidecar_data/antigravity-pulse/panel/data"
SKIN_DATA="$HOME/.gemini/antigravity/sidecar_data/antigravity-skin/panel/data"
if [ -d "$PULSE_DATA" ]; then
    mkdir -p "$SKIN_DATA"
    for sub in history-v1 usage-v1; do
        if [ -d "$PULSE_DATA/$sub" ] && [ ! -d "$SKIN_DATA/$sub" ]; then
            cp -R "$PULSE_DATA/$sub" "$SKIN_DATA/$sub"
        fi
    done
fi
if [ -d "$PULSE_DIR" ] && [ ! -L "$PULSE_DIR" ]; then
    rm -rf "$PULSE_DIR"
fi

# 备份已有个性化配置
USER_CONFIG_BACKUP=""
if [ -f "$TARGET_DIR/config/config.json" ]; then
    USER_CONFIG_BACKUP=$(cat "$TARGET_DIR/config/config.json")
fi

mkdir -p "$TARGET_DIR"

# 实体文件拷贝（杜绝软链接，确保用户解压后删除源文件依然完好）
WHITELIST_DIRS=("client" "sidecars" "assets" "scripts")
WHITELIST_FILES=("plugin.json", "config.default.json" "package.json" "README.md" "CHANGELOG.md" "loadingOverlay.js" "provisionSplash.js" "install.bat" "uninstall.bat" "install.ps1" "uninstall.ps1" "install.sh" "uninstall.sh" "patch-loading.bat" "restore-loading.bat" "self-heal.bat")
# 修正 bash 数组元素格式
WHITELIST_FILES=("plugin.json" "config.default.json" "package.json" "README.md" "CHANGELOG.md" "loadingOverlay.js" "provisionSplash.js" "install.bat" "uninstall.bat" "install.ps1" "uninstall.ps1" "install.sh" "uninstall.sh" "patch-loading.bat" "restore-loading.bat" "self-heal.bat")

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

chmod +x "$TARGET_DIR/install.sh" "$TARGET_DIR/uninstall.sh" 2>/dev/null || true

mkdir -p "$TARGET_DIR/config"
if [ -n "$USER_CONFIG_BACKUP" ]; then
    printf "%s\n" "$USER_CONFIG_BACKUP" > "$TARGET_DIR/config/config.json"
elif [ ! -f "$TARGET_DIR/config/config.json" ] && [ -f "$TARGET_DIR/config.default.json" ]; then
    cp "$TARGET_DIR/config.default.json" "$TARGET_DIR/config/config.json"
fi

# 读取或平滑初始化 kernelInjection 与 macLauncherMode（默认 100% 零改包；存量老用户平滑继承）
FEATURE_INFO=$(python3 -c "
import json, os

cfg_path = os.path.expanduser('$TARGET_DIR/config/config.json')
data = {}
if os.path.exists(cfg_path):
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        data = {}

features = data.setdefault('features', {})
ki = features.get('kernelInjection')
changed = False
if not isinstance(ki, bool):
    ki = False
    candidates = [
        os.path.expanduser('~/Library/Application Support/AntigravitySkin.noindex/Antigravity.app/Contents/Resources/app.asar'),
        '/Applications/Antigravity.app/Contents/Resources/app.asar',
        os.path.expanduser('~/Applications/Antigravity.app/Contents/Resources/app.asar'),
        '/usr/lib/antigravity/resources/app.asar',
        '/opt/Antigravity/resources/app.asar',
        '/opt/antigravity/resources/app.asar',
    ]
    for ap in candidates:
        if os.path.exists(ap):
            try:
                with open(ap, 'rb') as f:
                    if b'agy-video-boot-host' in f.read():
                        ki = True
                        break
            except Exception:
                pass
    features['kernelInjection'] = ki
    changed = True

mode = features.get('macLauncherMode')
if mode not in ('isolate', 'keep_original'):
    features['macLauncherMode'] = 'isolate'
    mode = 'isolate'
    changed = True

if changed:
    tmp = f'{cfg_path}.tmp.{os.getpid()}'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, cfg_path)

print(('1' if ki else '0') + '|' + mode)
" 2>/dev/null || echo "0|isolate")
KERNEL_INJECTION="${FEATURE_INFO%%|*}"
MAC_LAUNCHER_MODE="${FEATURE_INFO##*|}"

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
plugins.pop('antigravity-pulse', None)
if isinstance(data.get('sidecars'), dict):
    data['sidecars'].pop('antigravity-pulse/panel', None)

tmp_file = f'{config_file}.tmp.{os.getpid()}'
with open(tmp_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
os.replace(tmp_file, config_file)
" 2>/dev/null || true

LAUNCH_TARGET="Antigravity"

if [ "$KERNEL_INJECTION" = "1" ]; then
    if [ -f "$TARGET_DIR/scripts/patch-boot-overlay.mjs" ] && command -v node >/dev/null 2>&1; then
        echo "[4/4] 检测到已开启可选内核注入，正在同步客户端补丁 (kernelInjection = true)..."
        node "$TARGET_DIR/scripts/patch-boot-overlay.mjs" || true
    fi
elif [ "$(uname -s)" = "Darwin" ]; then
    echo "[4/4] 正在配置 macOS 100% 零改包 / 零重签无感启动器 (模式: $MAC_LAUNCHER_MODE)..."
    ISOLATED_APP="$HOME/Library/Application Support/AntigravitySkin.noindex/Antigravity.app"
    SYSTEM_APP="/Applications/Antigravity.app"
    USER_APP="$HOME/Applications/Antigravity.app"
    KEEP_LAUNCHER="$HOME/Applications/Antigravity Skin.app"
    LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
    mkdir -p "$HOME/Library/Application Support/AntigravitySkin.noindex" 2>/dev/null || true

    SYSTEM_IS_LAUNCHER=0
    if [ -f "$SYSTEM_APP/Contents/Info.plist" ] && grep -q "com.antigravity-skin.launcher" "$SYSTEM_APP/Contents/Info.plist" 2>/dev/null; then
        SYSTEM_IS_LAUNCHER=1
    fi

    # 处理手动拖拽 dmg 覆盖场景：若 /Applications/Antigravity.app 是新版本原版应用且隔离区有旧版，刷新隔离区
    if [ "$SYSTEM_IS_LAUNCHER" -eq 0 ] && [ -d "$SYSTEM_APP" ] && [ -d "$ISOLATED_APP" ] && [ "$IS_INSIDE_HOST" -eq 0 ] && [ "$MAC_LAUNCHER_MODE" = "isolate" ]; then
        rm -rf "$ISOLATED_APP" 2>/dev/null || true
    fi

    if [ "$MAC_LAUNCHER_MODE" = "isolate" ]; then
        if [ "$SYSTEM_IS_LAUNCHER" -eq 0 ] && [ -d "$SYSTEM_APP" ]; then
            if [ "$IS_INSIDE_HOST" -eq 0 ]; then
                mv "$SYSTEM_APP" "$ISOLATED_APP"
                if [ -x "$LSREGISTER" ]; then
                    "$LSREGISTER" -u "$ISOLATED_APP" >/dev/null 2>&1 || true
                fi
            else
                echo "  💡 检测到正运行于 Antigravity 宿主终端，跳过在线迁移原版目录，仅更新外围包装。"
            fi
        fi
        REAL_APP=""
        for cand in "$ISOLATED_APP" "$USER_APP" "$SYSTEM_APP"; do
            if [ -d "$cand" ] && [ -f "$cand/Contents/Info.plist" ] && ! grep -q "com.antigravity-skin.launcher" "$cand/Contents/Info.plist" 2>/dev/null; then
                REAL_APP="$cand"
                break
            fi
        done
        if [ -n "$REAL_APP" ] && command -v osacompile >/dev/null 2>&1 && { [ ! -d "$SYSTEM_APP" ] || grep -q "com.antigravity-skin.launcher" "$SYSTEM_APP/Contents/Info.plist" 2>/dev/null; }; then
            LAUNCHER_TMP=$(mktemp -d)
            cat > "$LAUNCHER_TMP/launcher.applescript" <<EOF
on run
	set appPath to "$REAL_APP"
	do shell script "/usr/bin/open -a " & quoted form of appPath & " --args --remote-debugging-port=0"
end run

on open droppedItems
	set appPath to "$REAL_APP"
	set argList to ""
	repeat with itemRef in droppedItems
		set argList to argList & " " & quoted form of (POSIX path of itemRef)
	end repeat
	do shell script "/usr/bin/open -a " & quoted form of appPath & argList & " --args --remote-debugging-port=0"
end open

on open location targetUrl
	set appPath to "$REAL_APP"
	do shell script "/usr/bin/open -a " & quoted form of appPath & " " & quoted form of targetUrl & " --args --remote-debugging-port=0"
end open location
EOF
            rm -rf "$SYSTEM_APP" 2>/dev/null || true
            osacompile -o "$SYSTEM_APP" "$LAUNCHER_TMP/launcher.applescript" 2>/dev/null || true
            rm -rf "$LAUNCHER_TMP"
            python3 -c "
import plistlib, shutil, os

launcher = '$SYSTEM_APP'
real_app = '$REAL_APP'
lp = os.path.join(launcher, 'Contents/Info.plist')
rp = os.path.join(real_app, 'Contents/Info.plist')
if os.path.exists(lp) and os.path.exists(rp):
    with open(lp, 'rb') as f:
        ldata = plistlib.load(f)
    with open(rp, 'rb') as f:
        rdata = plistlib.load(f)
    ldata['CFBundleIdentifier'] = 'com.antigravity-skin.launcher'
    ldata['CFBundleName'] = 'Antigravity'
    ldata['CFBundleDisplayName'] = 'Antigravity'
    ldata['LSUIElement'] = True
    ldata['LSBackgroundOnly'] = False
    for k in ('CFBundleIconFile', 'CFBundleDocumentTypes', 'CFBundleURLTypes'):
        if k in rdata:
            ldata[k] = rdata[k]
    icon_name = rdata.get('CFBundleIconFile')
    if icon_name:
        if not icon_name.endswith('.icns'):
            icon_name += '.icns'
        src_icns = os.path.join(real_app, 'Contents/Resources', icon_name)
        if os.path.exists(src_icns):
            os.makedirs(os.path.join(launcher, 'Contents/Resources'), exist_ok=True)
            shutil.copy2(src_icns, os.path.join(launcher, 'Contents/Resources', icon_name))
    with open(lp, 'wb') as f:
        plistlib.dump(ldata, f)
" 2>/dev/null || true
            xattr -cr "$SYSTEM_APP" >/dev/null 2>&1 || true
            if [ -x "$LSREGISTER" ]; then
                "$LSREGISTER" -f "$SYSTEM_APP" >/dev/null 2>&1 || true
            fi
            LAUNCH_TARGET="$SYSTEM_APP"
        fi
    else
        mkdir -p "$HOME/Applications" 2>/dev/null || true
        REAL_APP=""
        for cand in "$SYSTEM_APP" "$USER_APP" "$ISOLATED_APP"; do
            if [ -d "$cand" ] && [ -f "$cand/Contents/Info.plist" ] && ! grep -q "com.antigravity-skin.launcher" "$cand/Contents/Info.plist" 2>/dev/null; then
                REAL_APP="$cand"
                break
            fi
        done
        if [ -n "$REAL_APP" ] && command -v osacompile >/dev/null 2>&1; then
            LAUNCHER_TMP=$(mktemp -d)
            cat > "$LAUNCHER_TMP/launcher.applescript" <<EOF
on run
	set appPath to "$REAL_APP"
	do shell script "/usr/bin/open -a " & quoted form of appPath & " --args --remote-debugging-port=0"
end run

on open droppedItems
	set appPath to "$REAL_APP"
	set argList to ""
	repeat with itemRef in droppedItems
		set argList to argList & " " & quoted form of (POSIX path of itemRef)
	end repeat
	do shell script "/usr/bin/open -a " & quoted form of appPath & argList & " --args --remote-debugging-port=0"
end open

on open location targetUrl
	set appPath to "$REAL_APP"
	do shell script "/usr/bin/open -a " & quoted form of appPath & " " & quoted form of targetUrl & " --args --remote-debugging-port=0"
end open location
EOF
            rm -rf "$KEEP_LAUNCHER" 2>/dev/null || true
            osacompile -o "$KEEP_LAUNCHER" "$LAUNCHER_TMP/launcher.applescript" 2>/dev/null || true
            rm -rf "$LAUNCHER_TMP"
            python3 -c "
import plistlib, os
lp = '$KEEP_LAUNCHER/Contents/Info.plist'
if os.path.exists(lp):
    with open(lp, 'rb') as f:
        ldata = plistlib.load(f)
    ldata['CFBundleIdentifier'] = 'com.antigravity-skin.launcher'
    ldata['CFBundleName'] = 'Antigravity Skin'
    ldata['LSUIElement'] = True
    with open(lp, 'wb') as f:
        plistlib.dump(ldata, f)
" 2>/dev/null || true
            xattr -cr "$KEEP_LAUNCHER" >/dev/null 2>&1 || true
            LAUNCH_TARGET="$KEEP_LAUNCHER"
        fi
    fi

    # macOS CLI 包装：保留官方数字签名同时默认附带 CDP 参数
    mkdir -p "$HOME/.local/bin" 2>/dev/null || true
    CLI_APP="${REAL_APP:-/Applications/Antigravity.app}"
    cat > "$HOME/.local/bin/antigravity" <<EOF
#!/usr/bin/env bash
# antigravity-skin zero-patch launcher wrapper
open -a "$CLI_APP" "\$@" --args --remote-debugging-port=0 2>/dev/null || open -b com.google.antigravity "\$@" --args --remote-debugging-port=0 2>/dev/null
EOF
    chmod +x "$HOME/.local/bin/antigravity" 2>/dev/null || true
else
    # Linux 零改包 CLI 与 .desktop 包装
    mkdir -p "$HOME/.local/bin" 2>/dev/null || true
    cat > "$HOME/.local/bin/antigravity" <<'EOF'
#!/usr/bin/env bash
# antigravity-skin zero-patch launcher wrapper
REAL_BIN=""
for p in /usr/bin/antigravity /usr/local/bin/antigravity /opt/Antigravity/antigravity /opt/antigravity/antigravity; do
    if [ -x "$p" ] && [ "$p" != "$0" ]; then REAL_BIN="$p"; break; fi
done
if [ -z "$REAL_BIN" ]; then echo "Antigravity binary not found" >&2; exit 1; fi
exec "$REAL_BIN" --remote-debugging-port=0 "$@"
EOF
    chmod +x "$HOME/.local/bin/antigravity" 2>/dev/null || true
    if [ -d "$HOME/.local/share/applications" ]; then
        for df in "$HOME/.local/share/applications"/*antigravity*.desktop; do
            if [ -f "$df" ] && ! grep -q "remote-debugging-port" "$df" 2>/dev/null; then
                sed -i 's|^Exec=\(.*\)$|Exec=\1 --remote-debugging-port=0|' "$df" 2>/dev/null || true
            fi
        done
    fi
fi

if [ "$IS_INSIDE_HOST" -eq 1 ]; then
    echo "✨ 插件与启动入口已全量就绪！"
else
    echo "✨ 正在自动为您重新拉起 Antigravity 客户端..."
    if [ "$(uname -s)" = "Darwin" ]; then
        if [ -d "$LAUNCH_TARGET" ]; then
            open -a "$LAUNCH_TARGET" 2>/dev/null || true
        else
            open -a Antigravity --args --remote-debugging-port=0 2>/dev/null || open -b com.google.antigravity --args --remote-debugging-port=0 2>/dev/null || true
        fi
    else
        "$HOME/.local/bin/antigravity" >/dev/null 2>&1 &
    fi
fi

echo "=================================================="
echo " [√] 安装部署完成！"
echo " 插件已部署至: $TARGET_DIR"
echo "--------------------------------------------------"
echo " 🔔 重要提示："
echo " 插件核心文件已全部复制到上述持久化目录。"
echo " 当前解压出来的安装包文件夹【已不需要，请直接删除】！"
echo " 本地无需保留任何多余文件，完全不影响插件正常运行。"
echo "--------------------------------------------------"
if [ "$KERNEL_INJECTION" = "1" ]; then
    echo " ⚡ 当前运行模式：可选内核注入模式 (kernelInjection = true)"
    echo "   如需随时恢复官方原版 100% 未修改包，可在插件控制面板一键切换，或运行 node scripts/restore-boot-overlay.mjs。"
else
    echo " 🛡️ 当前运行模式：100% 零改包 / 零重签纯净启动 (推荐默认)"
    echo "   全程未修改任何官方 app.asar 与数字签名，仅通过无感启动器附带调试端口激活插件。"
    echo "   如需开机首帧视频等高阶能力，可在插件控制面板底部开启「内核级前置注入 (实验性)」。"
fi
echo "=================================================="
