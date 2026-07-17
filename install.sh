#!/usr/bin/env bash
# Droploid CLI installer (macOS + Linux). One-liner:
#   curl -fsSL https://raw.githubusercontent.com/mhdibrahimcn/droploid-cli/main/install.sh | bash
set -euo pipefail

REPO="https://github.com/mhdibrahimcn/Droploid-_electron.git"
DIR="${DROPLOID_HOME:-$HOME/.droploid}"

command -v git >/dev/null || { echo "droploid: git is required"; exit 1; }
command -v npm >/dev/null || { echo "droploid: Node.js (npm) is required"; exit 1; }

if [ -d "$DIR/.git" ]; then
  echo "→ Updating $DIR"
  git -C "$DIR" pull --ff-only -q
else
  echo "→ Cloning Droploid to $DIR"
  git clone -q "$REPO" "$DIR"
fi

echo "→ Building (first run takes a minute)"
( cd "$DIR" && npm ci --silent && npm run build >/dev/null )

# Release tools — best-effort, once. fastlane gives `fastlane supply` (Play upload);
# cocoapods is needed for iOS. Skipped if already present. Set DROPLOID_NO_TOOLS=1 to skip.
if [ "${DROPLOID_NO_TOOLS:-0}" != "1" ]; then
  if command -v brew >/dev/null; then
    command -v fastlane >/dev/null || { echo "→ Installing fastlane"; brew install fastlane || true; }
    command -v pod >/dev/null      || { echo "→ Installing cocoapods"; brew install cocoapods || true; }
  else
    echo "  (Homebrew not found — install fastlane + cocoapods yourself; then run 'droploid tools')"
  fi
fi

BIN="${DROPLOID_BIN:-/usr/local/bin}"
[ -w "$BIN" ] || BIN="$HOME/.local/bin"
mkdir -p "$BIN"
cat > "$BIN/droploid" <<EOF
#!/usr/bin/env bash
exec "$DIR/node_modules/.bin/electron" "$DIR/out/main/index.js" --cli "\$@"
EOF
chmod +x "$BIN/droploid"

echo "✓ Installed → $BIN/droploid"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "  Add to PATH:  export PATH=\"$BIN:\$PATH\"" ;; esac
echo "  Check tools:  droploid tools"
echo "  Get started:  droploid setup"
