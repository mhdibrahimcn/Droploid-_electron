# Droploid CLI

> **Deploy Flutter, iOS & Android apps to the App Store, TestFlight & Google Play — from one command.** Built for humans *and* AI agents.

`droploid` is a headless command-line deploy manager for mobile apps. It builds, signs, versions,
and uploads Flutter and native iOS/Android projects to the **Apple App Store**, **TestFlight**, and
the **Google Play Store** — plus **Shorebird** over-the-air (OTA) code-push patches — without opening
a GUI. Every command speaks JSON, so an **AI agent** can drive your entire mobile release pipeline.

```bash
droploid deploy --app "MyApp" --platform both --track production --bump patch --json
```

---

## Why Droploid CLI

- 🚀 **One-command deploys** — build + sign + upload iOS and Android in a single call.
- 🤖 **Agent-native** — `--json` on every command, `stdout` = machine result, `stderr` = logs, exit `0`/`1`. No scraping.
- 🔁 **Shorebird OTA patches** — ship JS/Dart fixes over-the-air, no store review.
- 🔐 **Secure credentials** — App Store Connect API key (`.p8`) and Play service-account JSON live in the OS keychain, never in argv or stdout.
- 📦 **Version bumping** — `--bump patch|minor|major|buildOnly` writes back to `pubspec.yaml`.
- ✅ **Preflight checks** — catch missing tools/creds *before* a 20-minute build fails.
- 🍏 **macOS + Linux** — Homebrew or one-line `install.sh`. (iOS builds need macOS + Xcode; Android works anywhere.)

---

## Install

### Homebrew (macOS & Linux)

```bash
brew install --HEAD mhdibrahimcn/tap/droploid
# or, from this repo:
brew install --HEAD ./HomebrewFormula/droploid.rb
```

### One-line script

```bash
curl -fsSL https://raw.githubusercontent.com/mhdibrahimcn/droploid/main/install.sh | bash
```

### From source

```bash
git clone https://github.com/mhdibrahimcn/droploid.git
cd droploid && npm ci && npm run build && ./install.sh
```

`install.sh` builds the app and drops a `droploid` shim on your `PATH` (`/usr/local/bin` or `~/.local/bin`).

---

## Quickstart

```bash
droploid tools --json          # check toolchain: flutter, fastlane, xcode, cocoapods…
droploid config-org --name "Acme" \
  --ios-key-id KID --ios-issuer-id IID --ios-team-id TID --ios-p8 ./AuthKey.p8 \
  --android-json ./play-service-account.json --json    # → {"id":"<orgId>","name":"Acme"}
droploid link ./my_flutter_app --org "Acme" --json      # detect & link the project
droploid preflight --app "my_flutter_app" --json        # {passed, checks[]}
droploid deploy --app "my_flutter_app" --track production --bump patch --json
```

---

## Commands

| Command | Description |
|---|---|
| `droploid orgs` | List organisations |
| `droploid apps [--org <id\|name>]` | List linked apps |
| `droploid tools` | Check the mobile release toolchain |
| `droploid link <dir> --org <id\|name>` | Detect & link a Flutter/iOS/Android project |
| `droploid config-org --name <name> [creds]` | Create an org (prints its `id`) |
| `droploid config-org --id <id> [creds]` | Update an org's credentials |
| `droploid preflight --app <id\|name>` | Run pre-deploy checks |
| `droploid deploy --app <id\|name> [opts]` | Build, sign & upload |
| `droploid patch --app <id\|name>` | Shorebird OTA patch (no store upload) |
| `droploid history --app <id\|name>` | Recent build runs |

Apps and orgs resolve by **id or name**.

### Deploy options

| Flag | Values | Default |
|---|---|---|
| `--platform` | `ios` · `android` · `both` | `both` |
| `--track` | `internal` · `beta` · `production` (Android) | `internal` |
| `--bump` | `none` · `buildOnly` · `patch` · `minor` · `major` | `none` |
| `--rollout` | `0`–`1` staged production rollout | — |
| `--notes` | release-notes string | — |
| `--shorebird` | build a patchable Shorebird release | off |

### Credential flags (`config-org`)

`--ios-key-id` · `--ios-issuer-id` · `--ios-team-id` · `--ios-p8 <path>` · `--android-json <path>`

---

## For AI agents

Every command accepts `--json`:

- **stdout** — a single JSON object/array (the result). Parse this.
- **stderr** — human-readable build logs. Surface the tail on failure.
- **exit code** — `0` = success, `1` = failure.

Recommended flow:

```
droploid apps --json                          → pick app id/name
droploid preflight --app <ref> --json          → abort if passed=false, report blockers
droploid deploy --app <ref> [flags] --json     → read {result}; exit 1 = failed
```

A ready-made **Claude Code / agent skill** ships in [`.claude/skills/droploid-deploy/`](.claude/skills/droploid-deploy/SKILL.md)
with SEO-tuned triggers (deploy, ship, release, TestFlight, App Store, Play Store, OTA patch, bump version).

---

## How it works

The CLI runs **inside Electron** in headless mode (a `--cli` argv branch), reusing the exact same
build engine, keychain, and data store as the Droploid desktop app — so the CLI and GUI always share
one source of truth for orgs, apps, and build history.

## Requirements

- **Node.js** 18+ (build) · **Flutter**, **fastlane**, **CocoaPods** on `PATH` (run `droploid tools`)
- **iOS**: macOS + Xcode · **Android**: any macOS/Linux · **OTA**: Shorebird CLI

## License

MIT
