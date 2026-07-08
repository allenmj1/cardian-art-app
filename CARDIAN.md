# Cardian Sprite Studio

This repository is **Cardian’s branded fork of [LibreSprite](https://github.com/LibreSprite/LibreSprite)** (GPLv2).

Players use it to create pixel art for Cardian cards, then **sync sprites to their Cardian account** (same cloud library as [Web Studio](https://playcardian.com/art-studio)).

| | |
|---|---|
| Product name | **Cardian Sprite Studio** |
| Website | https://playcardian.com/art-studio |
| Downloads | https://github.com/allenmj1/cardian-art-app/releases |
| Upstream | LibreSprite (GPLv2) |

## Account sync

Bundled with every release:

```
cardian-sync/
  package.json
  sync.mjs          # CLI: login, list, upload, download
  README.md
```

### CLI

```bash
cd cardian-sync
npm install   # optional; uses Node 18+ built-in fetch

# Open browser, sign in to Cardian, paste the session token
node sync.mjs login

# Upload a PNG to your account
node sync.mjs upload ./my-art.png --name "Forest Goblin"

# List cloud sprites
node sync.mjs list
```

Login uses the Cardian desktop auth page:

`https://playcardian.com/art-studio/desktop-auth`

That page issues an access token for the signed-in player. Tokens are stored locally in `~/.cardian/sprite-studio-session.json`.

### Cloud API

| Action | Storage / table |
|--------|------------------|
| Upload PNG | `community-art` bucket → `sprites/{playerId}/{timestamp}.png` |
| Metadata | `player_sprites` (Supabase) |
| Folders | `player_sprite_folders` (Supabase) |
| Publish card | Web Studio / site (`submit_community_art`) |

See `cardian-sync/` for the full client.

## Building from source

Follow LibreSprite’s install docs, then build this tree. Branding overrides live in:

- `src/main/resources_win32.rc`
- `desktop/libresprite.desktop` (Cardian Sprite Studio)
- `desktop/Info.plist`
- `branding/app.json`

Binary output may still be named `libresprite` until the CMake target is renamed; release packaging renames artifacts to `cardian-sprite-studio-*`.

## Releases

GitHub Actions (`.github/workflows/release.yml`) builds release zips:

1. Pulls the matching LibreSprite upstream binaries (until self-hosted CI compiles this fork)
2. Applies Cardian branding files + `cardian-sync`
3. Publishes `cardian-sprite-studio-windows.zip`, `-macos-arm64.dmg` package, `-linux.AppImage`

Trigger: push a tag `v*`, or run the workflow manually.

## License

GPLv2 — same as LibreSprite / Aseprite heritage. Cardian-specific sync tooling in `cardian-sync/` is provided for use with Cardian Sprite Studio builds.
