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
echo "  Get started:  droploid setup"
