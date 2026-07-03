# Cardian Sprite Studio

**Cardian’s branded pixel art desktop app**, based on [LibreSprite](https://github.com/LibreSprite/LibreSprite) (GPLv2).

Create card art, then **sync sprites to your Cardian account** with the bundled `cardian-sync` CLI. Sprites show up in [Web Studio](https://playcardian.com/art-studio) on playcardian.com.

| | |
|---|---|
| Product | **Cardian Sprite Studio** |
| Downloads | [Releases](https://github.com/allenmj1/cardian-art-app/releases) |
| Account login | https://playcardian.com/art-studio/desktop-auth |
| Web studio | https://playcardian.com/art-studio/web |

See **[CARDIAN.md](./CARDIAN.md)** for branding, sync API, and release notes.

## Download

| Platform | Asset |
|----------|--------|
| Windows | `cardian-sprite-studio-windows.zip` |
| macOS (Apple Silicon) | `cardian-sprite-studio-macos-arm64.dmg` |
| Linux | `cardian-sprite-studio-linux.AppImage` |

After installing, use **File → Export** as PNG, then:

```bash
cd cardian-sync
node sync.mjs login
node sync.mjs upload ./my-art.png --name "My Card"
```

## Upstream

This project is a fork of LibreSprite, which originated as a fork of Aseprite under GPLv2.

* Real-time animation previews, onion skinning, layers & frames
* Pixel-precise tools, palettes, multiple sprites
* See [INSTALL.md](./INSTALL.md) to compile from source

## License

GNU General Public License version 2 — see [LICENSE.txt](./LICENSE.txt).
