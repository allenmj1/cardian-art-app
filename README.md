# Cardian Sprite Studio

**Download → run → sign in inside the app.**

Native desktop app for Cardian card art. Opens Sprite Studio in a Cardian-branded window so players log in, draw, save, and publish without a separate CLI.

| | |
|---|---|
| Product | **Cardian Sprite Studio** |
| Downloads | [Releases](https://github.com/allenmj1/cardian-art-app/releases) |
| Website | https://playcardian.com/art-studio |

## For players

1. Download the zip for your platform
2. Run **CardianSpriteStudio**
3. Sign in with your Cardian account **in the app window**
4. Open the editor, draw, Save or Publish

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
