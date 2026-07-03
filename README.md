# Cardian Card Art Studio

**Download → run → sign in → make card art.** This is **not** the Cardian game client.

Native desktop app for card art only. Opens Card Art Studio in a branded window: login, LibreSprite-style editor, save sprites to your Cardian account.

| | |
|---|---|
| Product | **Cardian Card Art Studio** |
| Downloads | [Releases](https://github.com/allenmj1/cardian-art-app/releases) |
| App URL | https://playcardian.com/art-studio/app |

## For players

1. Download **CardianSpriteStudio.exe**
2. Double-click to run
3. Sign in with your Cardian account **on the app landing screen**
4. Draw with the branded pixel editor and **Save to account**

## Develop

```bash
cd desktop-app
npm install
npm start
```

## Build release packages

```bash
node scripts/package-release.mjs
node scripts/publish-release.mjs v1.2.0
```

App source: `desktop-app/` (Electron). Players only receive compiled binaries.
