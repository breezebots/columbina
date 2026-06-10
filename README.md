# 🎭 Columbina — Discord Music Bot

A Discord music bot that plays YouTube audio in voice channels, with an owner-controlled no-prefix system.

## Commands

### 🎵 Music
| Command | Alias | Description |
|---|---|---|
| `!play <song/url>` | `!p` | Play a song or add to queue |
| `!skip` | `!s` | Skip current song |
| `!stop` | — | Stop and clear the queue |
| `!pause` | — | Pause playback |
| `!resume` | `!r` | Resume playback |
| `!queue` | `!q` | Show the current queue |
| `!np` | `!nowplaying` | Show now playing |
| `!leave` | `!disconnect` | Disconnect bot from voice |
| `!help` | — | Show all commands |

### 🔒 Owner Only
| Command | Description |
|---|---|
| `!grant @user` | Give a user no-prefix access (they can type `play ...` without `!`) |
| `!revoke @user` | Remove no-prefix access from a user |
| `!noprefix` | List all users with no-prefix access in this server |

> No-prefix users stay whitelisted until the bot restarts or the owner revokes them.

## Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- `ffmpeg` installed on your system:
  - **Linux:** `sudo apt install ffmpeg`
  - **Mac:** `brew install ffmpeg`
  - **Windows:** https://ffmpeg.org/download.html

### 2. Create a Discord Bot
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it **Columbina**
3. Go to **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - ✅ Message Content Intent
   - ✅ Server Members Intent
5. Copy your **Bot Token**

### 3. Get Your Owner ID
1. In Discord, go to **Settings → Advanced** and enable **Developer Mode**
2. Right-click your own username → **Copy User ID**

### 4. Invite Bot to Your Server
1. Go to **OAuth2 → URL Generator**
2. Scopes: `bot`
3. Permissions: `Send Messages`, `Connect`, `Speak`, `Read Message History`
4. Open the generated URL and invite the bot

### 5. Install & Run

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env: paste your DISCORD_TOKEN and OWNER_ID

# Start the bot
npm start

# Development mode (auto-restart)
npm run dev
```

## No-Prefix Feature
As the owner, you can grant trusted users the ability to skip the `!` prefix entirely:

```
!grant @friend       → friend can now type: play lofi hip hop
!revoke @friend      → removes their no-prefix access
!noprefix            → shows all no-prefix users in this server
```

The owner always has no-prefix access by default.
