---
name: droploid-deploy
description: Deploy, ship, or release Flutter, iOS, and Android apps to the App Store, TestFlight, and Google Play from the command line using the Droploid CLI. Use when the user wants to deploy an app, ship a build, publish a release, push to TestFlight or Play Store, bump a version, run an over-the-air Shorebird patch, configure signing credentials (App Store Connect API key, .p8, Play service-account JSON), link an app project, run pre-deploy preflight checks, or check the mobile release toolchain (flutter, fastlane, xcode, cocoapods). Triggers: "deploy", "release", "ship it", "publish app", "TestFlight", "App Store", "Play Store", "OTA patch", "bump version", "mobile CI".
---

# Droploid Deploy

Drive the `droploid` CLI to build and upload mobile apps. Always pass `--json` — stdout is
machine-readable, human logs go to stderr. Resolve apps/orgs by **id or name**.

## Quickstart

```bash
droploid orgs --json                    # list orgs → [{id,name}]
droploid apps --json                    # list linked apps → [{id,name,projectType,currentVersion}]
droploid tools --json                   # toolchain check → [{name,state,version}]
```

## Configure (one-time per org)

```bash
# create org + store signing creds (creds go to the macOS Keychain, never stdout)
droploid config-org --name "Acme" \
  --ios-key-id KID --ios-issuer-id IID --ios-team-id TID --ios-p8 /path/AuthKey.p8 \
  --android-json /path/play-service-account.json --json
# → {"id":"<orgId>","name":"Acme"}

droploid link ./my_flutter_app --org "Acme" --json   # detect & link → {id,name,projectType,...}
```

## Deploy

```bash
droploid preflight --app "MyApp" --json              # {passed:bool, checks:[...]} — check before deploy
droploid deploy --app "MyApp" --json                 # both platforms, track=internal, no version bump
droploid deploy --app "MyApp" --platform android --track production --rollout 0.1 --bump patch --json
droploid deploy --app "MyApp" --platform ios --bump buildOnly --json
droploid deploy --app "MyApp" --shorebird --notes "Bugfixes" --json   # patchable Shorebird release
droploid patch  --app "MyApp" --json                 # Shorebird OTA patch, no store upload
droploid history --app "MyApp" --json                # recent build runs
```

Flags: `--platform ios|android|both` · `--track internal|beta|production` ·
`--bump none|buildOnly|patch|minor|major` · `--rollout 0..1` · `--notes "…"` · `--shorebird`.

## Agent workflow

1. `droploid apps --json` → find the app id/name.
2. `droploid preflight --app <ref> --json` → abort if `passed:false` (report blockers).
3. `droploid deploy --app <ref> [flags] --json` → **exit 0 = success, exit 1 = failed**; read `result` from stdout.
4. On failure, surface the tail of stderr (the actual build error).

Notes: iOS builds require macOS + Xcode. Missing creds/tools show up in `preflight`/`tools` —
run those first if a deploy fails fast.
