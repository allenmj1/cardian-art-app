# Cardian Sprite Studio (Desktop)

Simple desktop app: **download → run → sign in inside the window**.

Opens the Cardian Sprite Studio site in a native window with Cardian branding. Login, drawing, save, and publish all happen in the UI — no CLI or token paste.

The app loads the live studio home screen: saved art and folders first, then create-new canvas types (Card, Avatar, Banner, Frame) — same as Web Studio.

## Develop

```bash
npm install
npm start
```

## Build

```bash
npm run pack:win    # CardianSpriteStudio.exe (portable)
npm run pack:linux  # CardianSpriteStudio.AppImage
```

Output: `desktop-app/dist/`

## Release (version always increases)

From the repo root:

```bash
node scripts/package-release.mjs   # auto-bumps patch in package.json, then builds
node scripts/publish-release.mjs   # publishes GitHub release as v{package.json version}
```

Every `package-release` run increments the version (e.g. `1.3.4` → `1.3.5`) so update checks always see a newer build. Force a specific version with:

```bash
DESKTOP_VERSION=1.4.0 node scripts/package-release.mjs
```

After releasing, set `STUDIO_DESKTOP_VERSION` in the Cardian website repo (`src/utils/spriteStudioDownloads.ts`) to the same number.
