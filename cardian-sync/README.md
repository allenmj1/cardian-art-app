# Cardian Sync

CLI bundled with **Cardian Sprite Studio** to upload sprites to your Cardian account.

## Setup

Requires [Node.js 18+](https://nodejs.org/).

Optional environment variables (defaults point at production Cardian):

```bash
set CARDIAN_SUPABASE_URL=https://your-project.supabase.co
set CARDIAN_SUPABASE_ANON_KEY=your-anon-key
set CARDIAN_AUTH_URL=https://playcardian.com/art-studio/desktop-auth
```

## Commands

```bash
node sync.mjs login
node sync.mjs status
node sync.mjs folders
node sync.mjs mkdir "Card concepts"
node sync.mjs list
node sync.mjs upload path/to/art.png --name "My Card Art" --folder "Card concepts"
node sync.mjs logout
```

## Login flow

1. Run `node sync.mjs login`
2. Browser opens `https://playcardian.com/art-studio/desktop-auth`
3. Sign in to Cardian if needed
4. Copy the access token and paste it into the terminal
5. Session is saved to `~/.cardian/sprite-studio-session.json`

Sprites and folders appear under **Your Saved Sprites** at https://playcardian.com/art-studio
