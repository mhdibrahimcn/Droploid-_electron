#!/usr/bin/env bash
# Droploid CLI installer (macOS + Linux). Builds from source if no packaged app is found,
# then drops a `droploid` shim on your PATH.
#   curl -fsSL <raw-url>/install.sh | bash      # or: ./install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# Pick a bin dir already on PATH, preferring system dirs on mac.
pick_bindir() {
  for d in /usr/local/bin "$HOME/.local/bin"; do
    case ":$PATH:" in *":$d:"*) [ -w "$d" ] || [ ! -e "$d" ] && { echo "$d"; return; } ;; esac
  done
  echo "$HOME/.local/bin"
}
BINDIR="$(pick_bindir)"
mkdir -p "$BINDIR"

APP="/Applications/Droploid.app/Contents/MacOS/Droploid"
if [ -x "$APP" ]; then
  echo "→ Using installed Droploid.app"
  TARGET_CMD="exec \"$APP\" --cli \"\$@\""
else
  echo "→ Building Droploid from source ($REPO_DIR)"
  command -v npm >/dev/null || { echo "npm required (install Node.js first)"; exit 1; }
  ( cd "$REPO_DIR" && { [ -d node_modules ] || npm ci; } && npm run build )
  TARGET_CMD="exec \"$REPO_DIR/node_modules/.bin/electron\" \"$REPO_DIR/out/main/index.js\" --cli \"\$@\""
fi

SHIM="$BINDIR/droploid"
cat > "$SHIM" <<EOF
#!/usr/bin/env bash
$TARGET_CMD
EOF
chmod +x "$SHIM"

echo "✓ Installed: $SHIM"
case ":$PATH:" in *":$BINDIR:"*) ;; *) echo "  ⚠ Add to PATH:  export PATH=\"$BINDIR:\$PATH\"" ;; esac
echo "  Try:  droploid help"
