# OrionBot

OrionBot is a configurable Discord bot for Minecraft communities. It reports server information, keeps Discord status surfaces current, and adds community feedback tools for suggestions, reviews, and away status.

## Fork notice

This project is a fork of [NooberPro/minecraft-discord-bot](https://github.com/NooberPro/minecraft-discord-bot). It retains the upstream [MIT License](LICENSE) and its Minecraft-server bot foundation while adding the fork-specific features described below.

## Features

### Minecraft server and Discord essentials

- **Java and Bedrock support** — Check either type of Minecraft server for availability, player counts, version, and MOTD information.
- **Server information commands** — Let members retrieve the server IP, website, version, MOTD, online status, player list, and command help.
- **Configurable bot presence** — Change the bot's activity and status automatically according to whether the Minecraft server is online.
- **Live status message** — Maintain a Discord message with the current server status and player list.
- **Player-count channel** — Keep a channel name updated with the live player count or offline state.
- **Player avatars** — Show player avatars beside names in the Java player list when enabled.
- **Auto replies** — Respond to configurable IP, version, website, and status trigger phrases in selected channels.
- **Customizable configuration** — Configure server details, embed colors, channel access, command aliases, permissions, and feature behavior in [`config.js`](config.js).
- **Multilingual interface** — Includes English, Spanish, German, French, Portuguese, Russian, Ukrainian, and Dutch translation files.
- **Console logging and error handling** — Provides configurable startup, server, error, and debug logging.
- **Free-hosting friendly checks** — Supports an online-check mode suitable for servers that report an empty player limit while starting.

### Added in this fork

#### Away / AFK status

- Members can use `/away` to set an away status with an optional reason through a modal.
- Mentions of an away member receive an embed containing their reason and away time.
- An away status can clear automatically when the member next sends a message, and `/away-test` previews the notification privately.
- Access, maximum reason length, automatic clearing, and embed content are configurable.

#### Suggestions

- Messages in configured suggestion channels are converted into structured suggestion embeds, optionally in a separate board channel.
- Members can upvote or downvote; vote permissions, self-voting, vote changes, counts, labels, emojis, and styles are configurable.
- Staff can approve or reject suggestions with role- and permission-based moderation controls.
- Each suggestion can create a discussion thread, lock or remove buttons when resolved, post its resolution in the thread, and optionally DM its submitter.
- Submission roles, length limits, original-message deletion, and short warnings for invalid submissions are configurable.

#### Reviews

- Members can submit a star-rated review through `/review` or a persistent panel posted with `/review-panel`.
- Reviews use a rating picker and modal, then publish a customizable embed with reviewer details, rating colors, optional reactions, and a unique review ID.
- Members can mark reviews as useful or report them, with optional reason collection, staff notifications, and role pings.
- Staff can remove a review and its discussion thread with `/review-delete`; one-review-per-member and role-based submission/moderation rules are supported.
- Each review can create its own discussion thread for replies or follow-up.

## Commands

The bot supports slash commands and, where enabled, configurable prefix commands.

| Command | Purpose |
| --- | --- |
| `/ip`, `/motd`, `/players`, `/status`, `/version`, `/site` | Show Minecraft server information. |
| `/help`, `/info` | Show bot and command information. |
| `/setup`, `/setstatus` | Configure server details and the live status message. |
| `/away`, `/away-test` | Set, clear, or preview an away status. |
| `/review`, `/review-panel`, `/review-delete` | Submit, publish, and moderate reviews. |

Suggestions are submitted by sending a message in a configured suggestion channel rather than by using a slash command.

## Setup

1. Install a current supported version of [Node.js](https://nodejs.org/).
2. Install dependencies:

   ```sh
   npm install
   ```

3. Set `DISCORD_BOT_TOKEN` in a local `.env` file.
4. Update [`config.js`](config.js) with your Minecraft server and Discord configuration.
5. Start the bot:

   ```sh
   npm start
   ```

Run the automated checks with:

```sh
npm test
```

Do not commit your `.env` file; it is intentionally ignored by Git.

## License

OrionBot is distributed under the [MIT License](LICENSE). See the original project for the upstream implementation and history.
