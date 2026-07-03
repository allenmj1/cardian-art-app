# Cardian Sprite Studio (Desktop)

Simple desktop app: **download → run → sign in inside the window**.

Opens the Cardian Sprite Studio site in a native window with Cardian branding. Login, drawing, save, and publish all happen in the UI — no CLI or token paste.

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
