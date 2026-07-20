#!/usr/bin/env bash
# Droploid CLI installer (macOS + Linux). One-liner:
#   curl -fsSL https://raw.githubusercontent.com/mhdibrahimcn/droploid-cli/main/install.sh | bash
set -euo pipefail

REPO="https://github.com/mhdibrahimcn/Droploid-_electron.git"
DIR="${DROPLOID_HOME:-$HOME/.droploid}"

command -v git >/dev/null || { echo "droploid: git is required"; exit 1; }
command -v npm >/dev/null || { echo "droploid: Node.js (npm) is required"; exit 1; }

# Run a command with a live spinner + elapsed time (falls back to plain wait if not a TTY).
spin() {
  local msg="$1"; shift
  ( "$@" ) & local pid=$!
  if [ ! -t 1 ]; then wait "$pid"; return $?; fi
  local marks='|/-\' i=0 start=$SECONDS
  while kill -0 "$pid" 2>/dev/null; do
    i=$(( (i + 1) % 4 ))
    printf '\r  %s %s (%ds)   ' "${marks:$i:1}" "$msg" "$((SECONDS - start))"
    sleep 0.15
  done
  wait "$pid"; local rc=$?
  if [ $rc -eq 0 ]; then printf '\r  ✓ %s (%ds)        \n' "$msg" "$((SECONDS - start))"
  else printf '\r  ✗ %s\n' "$msg"; fi
  return $rc
}

BEFORE=""
if [ -d "$DIR/.git" ]; then
  BEFORE="$(git -C "$DIR" rev-parse HEAD)"
  spin "Updating Droploid" git -C "$DIR" pull --ff-only -q
else
  spin "Cloning Droploid → $DIR" git clone -q "$REPO" "$DIR"
fi
AFTER="$(git -C "$DIR" rev-parse HEAD)"

# Skip work that's already done: deps only when the lockfile changed (or node_modules missing),
# build only when the code changed (or out/ missing). Makes no-change re-runs near-instant.
NEED_DEPS=1; NEED_BUILD=1
if [ -n "$BEFORE" ] && [ "$BEFORE" = "$AFTER" ]; then
  [ -d "$DIR/node_modules" ] && NEED_DEPS=0
  [ -d "$DIR/out" ] && NEED_BUILD=0
else
  [ -d "$DIR/node_modules" ] && [ -n "$BEFORE" ] \
    && git -C "$DIR" diff --quiet "$BEFORE" "$AFTER" -- package-lock.json package.json 2>/dev/null \
    && NEED_DEPS=0
fi

if [ "$NEED_DEPS" = 1 ]; then
  DEPCOUNT="$(node -p "Object.keys({...require('$DIR/package.json').dependencies, ...require('$DIR/package.json').devDependencies}).length" 2>/dev/null || echo '?')"
  echo "→ Installing $DEPCOUNT direct dependencies (first run — downloads these + their deps):"
  node -p "Object.keys({...require('$DIR/package.json').dependencies, ...require('$DIR/package.json').devDependencies}).join(', ')" 2>/dev/null | fold -s -w 74 | sed 's/^/    /' || true
  ( cd "$DIR" && npm ci --no-audit --no-fund )   # not --silent: shows npm's live progress
  echo "  ✓ Dependencies installed"
else
  echo "  ✓ Dependencies up to date"
fi
if [ "$NEED_BUILD" = 1 ]; then spin "Building Droploid" bash -c "cd '$DIR' && npm run build >/dev/null 2>&1"; else echo "  ✓ Build up to date"; fi

# Release tools — best-effort, once. fastlane gives `fastlane supply` (Play upload);
# cocoapods is needed for iOS. Skipped if present. Set DROPLOID_NO_TOOLS=1 to skip.
if [ "${DROPLOID_NO_TOOLS:-0}" != "1" ]; then
  if command -v brew >/dev/null; then
    command -v fastlane >/dev/null || spin "Installing fastlane"  brew install fastlane  || true
    command -v pod >/dev/null      || spin "Installing cocoapods" brew install cocoapods || true
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
echo "  Get started:  droploid init"
