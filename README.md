# MLS Guru

A Discord FC-style pack-opening bot for your MLS league. The player database starts empty. Players must opt in with `/consent` before an admin can add their card.

## Features in this starter version

- Normal, Rare, Special and Promo packs.
- Coins, daily rewards, free daily pack credits and a cooldown-based `/work` command.
- Player collections, selling cards and a collector leaderboard.
- Custom MLS-themed Discord card embeds.
- Player consent: `/consent` opts a Discord user in; `/withdraw` removes their player card and copies from collections.
- Admin-only player add/edit/remove commands.
- SQLite persistence; no external database required.

## Requirements

- Node.js 20 or newer.
- A Discord application and bot token.
- A server where you can invite the bot.

## Setup

1. Create a bot application at https://discord.com/developers/applications.
2. Under **Bot**, create/reset its token. Keep the token private.
3. Under **OAuth2 → URL Generator**, select scopes `bot` and `applications.commands`. Give it permissions to View Channels, Send Messages, Embed Links and Use Application Commands. Invite it to your server.
4. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN`: bot token
   - `CLIENT_ID`: application ID
   - `GUILD_ID`: your Discord server ID (for quick server-only command registration)
   - `ADMIN_USER_IDS`: your Discord user ID(s), comma-separated
5. Install and register commands:
   ```bash
   npm install
   npm run register
   npm start
   ```

The bot creates its SQLite database automatically in `data/guru.sqlite`.

## Commands

### Everyone
- `/consent` — opt in to having an MLS Guru player card.
- `/withdraw` — withdraw consent and remove your player from the pack pool and all collections.
- `/pack type:<normal|rare|special|promo>` — open a pack. A daily free-pack credit is used for Normal packs first.
- `/daily` — claim 200 coins and one free Normal pack credit every 24 hours.
- `/work` — earn 50–150 coins; 1-hour cooldown.
- `/collection` — view your cards and card IDs.
- `/sell card_id:<id>` — sell one of your cards.
- `/leaderboard` — view the top collectors.

### Admins
- `/addplayer user:<member> name:<name> club:<club> position:<position> rating:<60–99> rarity:<bronze|silver|gold|special|promo>`
  - The selected Discord member must have used `/consent`.
- `/editplayer player_id:<id> rating:<optional> rarity:<optional> club:<optional> position:<optional>`
- `/removeplayer player_id:<id>`

Admins are configured in `ADMIN_USER_IDS` or can be server members with the Administrator permission.

## Pack odds

The first version uses weighted card tiers based on each player's admin-set rating/rarity. Pack tier filters:
- Normal: all active players.
- Rare: rating 70+.
- Special: rating 82+.
- Promo: rating 90+ or rarity Promo.

The bot does not generate or import real players automatically. Only opted-in players can be added.

## Important

Never commit your real `.env` file or share your bot token. If a token is exposed, reset it immediately in the Discord Developer Portal.
