// Config Documentation: https://nooberpro.gitbook.io/minecraft-discord-bot/installation/config
// "MC" refers to Minecraft in the comments for convenience.
module.exports = {
  bot: {
    token: process.env.DISCORD_BOT_TOKEN || 'your-bot-token-here',
    // Automatically updates the bot's status and activity.
    presence: {
      enabled: true,
      activity: 'Playing', // Options: Playing, Listening, Watching, Competing.
      text: {
        online: 'with {playeronline}/{playermax} players', // {playeronline} and {playermax} display the current and maximum number of players.
        offline: 'Server Offline', // Status text when the server is offline.
      },
      status: {
        // Options: online, idle, dnd, invisible.
        online: 'online', // Bot status when the MC server is online.
        offline: 'idle', // Bot status when the MC server is offline.
      },
    },
  },
  mcserver: {
    ip: 'demo.mcstatus.io', // IP address of the MC server.
    port: 25565, // Port number of the MC server. Use Query Port in Java for the full player list.
    type: 'java', // Type of MC server: "java" or "bedrock".
    name: 'Demo Server', // Name of the MC server.
    version: 'Requires 1.8 - 1.20', // Version of the MC server.
    icon: 'https://i.imgur.com/6Msem8Q.png', // URL of the MC server icon. How to set it: https://tinyurl.com/iconurl
    site: 'https://nooberpro.gitbook.io/', // URL of the MC server or vote website. Leave blank to disable site commands.
  },

  // Bot settings.
  settings: {
    language: {
      // Available languages:
      // en (English), es (Spanish), de (German), fr (French), pt (Portuguese), ru (Russian), uk (Ukrainian), nl(Dutch)
      main: 'en', // Main language (files in ./translation/)
      // Optional language settings for specific features. Leave blank to use the main language.
      embeds: '', // Language for embeds, Slash and Prefix Commands, Auto Changing Status.
      autoReply: '', // Language for auto-reply feature responses.
      consoleLog: '', // Language for console log output.
      slashCmds: '', // Language for slash commands descriptions and error messages.
    },
    embedsColors: {
      basicCmds: 'Aqua', // Color for basic commands like version, site, ip.
      online: 'Green', // Color for commands when the server is online (e.g., status, players, motd).
      offline: 'Red', // Color for offline status embeds.
    },
    // Console logging settings.
    logging: {
      timezone: '', // Time zone for the bot. Use formats like America/New_York or Europe/London. Leave blank to use the bot's local time zone.
      inviteLink: true, // Log the invite link at the bot's launch.
      debug: false, // Log status messages and bot activity updates (may result in spam).
      error: true, // Log any errors that occur.
      serverInfo: true, // Log basic server info and check if it's online at startup.
    },
  },

  // Feature settings

  // Automatically updates the MC server status in a channel in real-time.
  autoChangeStatus: {
    enabled: false,
    updateInterval: 60, // Interval between status updates in seconds. Recommended: above 60.
    adminOnly: true, // It makes admins who with the "Manage Channel" permission can only set the status message.
    playerAvatarEmoji: true, // Show player avatar in the player list. Only for Java and in adminOnly mode.
    // These settings apply to slash (/) and prefix commands for status.
    isOnlineCheck: true, // Useful for servers using free hosting providers like Aternos. If the server's max players is 0, the status will be set to offline.
  },

  // Shows the player count of the MC server in the channel name.
  playerCountCH: {
    enabled: false,
    guildID: 'your-guild-id-here', // Server ID for creating/editing channel stats.
    channelId: '', // Channel ID for editing the player count. If no ID is provided, the bot will create the channel itself.
    // {playeronline} and {playermax} display the current and maximum number of players.
    onlineText: '🟢 {playeronline}/{playermax} active players',
    offlineText: '🔴 Offline', // Name set when the MC server is offline.
  },

  autoReply: {
    // If a message contains trigger words, reply with appropriate server information.
    enabled: false, // Disable the entire auto-reply feature.
    deleteMsg: false, // This will delete the trigger message sent by user and response of the bot after 10 sec. (Avoids clutter in chat)
    // Channels where auto-reply are enabled. eg: ['1234567','8909876',].  The number given here is channel's id.
    enabledChannels: [],
    // Channels where auto-reply are disabled. eg: ['1234567','8909876',]. The number given here is channel's id.
    disabledChannels: [],
    version: {
      enabled: true,
      triggerWords: ['version of the server?', 'version'],
    },
    ip: {
      enabled: true,
      triggerWords: ['ip of the server', 'ip'],
    },
    site: {
      enabled: true,
      triggerWords: ['website link', 'website', 'url', 'site', 'vote url', 'link'],
    },
    status: {
      enabled: true,
      triggerWords: ['is server online?', 'is server offline', 'status of the server'],
    },
  },

  // Lets members mark themselves as away/AFK with a reason via /away.
  // Anyone who pings them while it's active gets an embed with their reason instead of silence.
  // Sending a message while away automatically turns the status off.
  // Use /away-test to preview the notification embed privately.
  away: {
    enabled: true,
    // Only members with one of these role IDs can use /away. Replace the placeholder with your role ID(s).
    allowedRoleIds: ['your-role-id-here'],
    autoClearOnMessage: true,
    reasonMaxLength: 200, // Max characters allowed in the away reason submitted through the form.
    // Variables available in title, message, and footer: {user}, {username}, {reason}.
    embed: {
      color: 'Orange',
      title: '{username} is away',
      message: 'Hey {user}, {username} is currently away.\n\n**Reason:** ```{reason}```',
      footer: 'Away since',
      showUserAvatar: true,
      showTimestamp: true,
    },
  },

  // Suggestions: any message sent in a configured channel is automatically converted into
  // a suggestion embed with upvote/downvote buttons for members and approve/reject buttons
  // for staff. A thread is attached to the embed automatically for discussion/feedback.
  suggestions: {
    enabled: false,
    // Channels where sent messages get converted into a suggestion embed. eg: ['1234567890']
    channels: [],
    // Post the suggestion embed in a different channel than the one it was submitted in
    // (e.g. members type in a public #suggestions channel but the embed + votes live in a
    // staff-curated #suggestion-board channel). Leave blank to post in the same channel.
    outputChannelId: '',
    deleteOriginalMessage: true, // Deletes the member's original message once it's converted into an embed.
    minLength: 3, // Minimum characters required for a suggestion.
    maxLength: 500, // Maximum characters allowed in a suggestion.

    // Who is allowed to submit suggestions in the configured channels.
    submitting: {
      allowedRoleIds: [], // Role IDs allowed to submit suggestions. Leave empty to allow everyone.
      deleteDisallowedMessage: true, // Deletes messages from members without an allowed role.
      warnDisallowedMessage: true, // Sends a short self-deleting warning when a disallowed message is removed.
    },

    // A thread is created and attached to every suggestion embed for discussion/feedback,
    // matching Discord's built-in "started a thread" preview shown under the embed.
    thread: {
      enabled: true,
      name: "Feedback on {username}'s suggestion", // {username} is available.
      // Auto-archive duration in minutes. Discord only accepts: 60, 1440, 4320, or 10080.
      autoArchiveMinutes: 10080,
    },

    embed: {
      // Fallback color, only used if a status below doesn't define its own color.
      color: 'Yellow',
      showSubmitterAsAuthor: true, // Shows the submitter's name/avatar at the top of the embed.
      showSubmitterAvatar: true, // Uses the submitter's avatar as the small author icon.
      thumbnailUrl: '', // Small image top-right of the embed. Leave blank to use mcserver.icon.
      showFooterLink: true, // Shows a site/vote link in the embed footer.
      footerText: '', // Leave blank to use mcserver.site.
      footerIconUrl: '', // Leave blank to use mcserver.icon.
      suggestionFieldName: 'Suggestion',
      statusFieldName: 'Status',
      votesFieldName: 'Votes',
      // {upvotes}, {downvotes}, {totalvotes}, and {bar} are available in this template.
      votesFieldValue: '🔺 {upvotes} upvotes • 🔻 {downvotes} downvotes\n{bar}',
      showVoteBar: true,
      voteBarLength: 14, // Number of characters that make up the vote progress bar.
      voteBarFilledChar: '🟩',
      voteBarEmptyChar: '⬜',
    },

    // Status shown in the embed and used for the embed's side color. "pending" is the
    // starting status; "approved"/"rejected" are applied by the moderation buttons below.
    statuses: {
      pending: { label: 'Pending', emoji: '⏳', color: 'Yellow' },
      approved: { label: 'Approved', emoji: '✅', color: 'Green' },
      rejected: { label: 'Rejected', emoji: '❌', color: 'Red' },
    },

    voting: {
      enabled: true,
      allowedRoleIds: [], // Role IDs allowed to vote. Leave empty to allow everyone.
      allowSelfVote: true, // Lets the submitter vote on their own suggestion.
      allowVoteChange: true, // Clicking the opposite vote switches the member's vote instead of being ignored.
      lockOnResolve: true, // Disables the vote buttons once a suggestion is approved or rejected.
      showCountsOnButtons: false, // Shows the live vote count in the button label itself, eg. "Upvote (6)".
      upvote: { label: 'Upvote', emoji: '⬆️', style: 'Primary' }, // style: Primary, Secondary, Success, Danger.
      downvote: { label: 'Downvote', emoji: '⬇️', style: 'Primary' },
    },

    moderation: {
      enabled: true,
      allowedRoleIds: [], // Role IDs allowed to approve/reject suggestions.
      // If true, members with the Administrator permission can always approve/reject,
      // even without one of the roles above.
      allowAdministrators: true,
      // If allowedRoleIds is empty and allowAdministrators is false, the Manage Server
      // permission is required as a safe fallback so this never ends up wide open by accident.
      approve: { label: 'Approve', emoji: '✅', style: 'Success' },
      reject: { label: 'Reject', emoji: '❌', style: 'Danger' },
      removeButtonsOnResolve: false, // Removes every button once resolved instead of just disabling them.
      postResolutionInThread: true, // Sends a short message in the suggestion's thread once it's resolved.
      dmSubmitter: false, // DMs the submitter when their suggestion is approved/rejected. Fails silently if DMs are closed.
    },
  },

  // Reviews: members can leave a star-rated review via a button (or the /review command).
  // Each review is posted as a fully customizable embed (title, fields, colors, footer) with
  // Report / Submit A Review / Useful buttons, similar to app review cards seen on Discord
  // (e.g. the ReviewHub bot). A discussion thread is attached to every review automatically.
  reviews: {
    enabled: false,
    // Channel where submitted reviews are posted. Leave blank to post in whichever channel
    // the "Submit A Review" button/command was used in.
    outputChannelId: '',
    minLength: 10, // Minimum characters required for the review text.
    maxLength: 800, // Maximum characters allowed for the review text.

    submitting: {
      allowedRoleIds: [], // Role IDs allowed to submit reviews. Leave empty to allow everyone.
      oncePerUser: true, // If true, a member can't submit a new review while they already have one posted.
      oncePerUserMessage: "You've already submitted a review. Ask staff to remove it if you'd like to leave a new one.",
    },

    rating: {
      min: 1,
      max: 5,
      filledEmoji: '⭐',
      emptyEmoji: '', // Leave blank to only show filled stars (no empty-star padding).
    },

    // The persistent panel posted by /review-panel — a static embed with the "Submit A
    // Review" button members click to leave feedback.
    panel: {
      title: 'ReviewHub',
      description: 'Enjoying **{server}**? Tap **Submit A Review** below to leave one!', // {server} is available.
      color: 'Blurple',
      thumbnailUrl: '', // Leave blank to use mcserver.icon.
      footerText: '',
      footerIconUrl: '', // Leave blank to use mcserver.icon.
    },

    // The form shown to collect the review text, right after a rating is picked.
    modal: {
      title: 'Submit A Review',
      reviewLabel: 'Your review',
      reviewPlaceholder: 'What did you like? What could be better?',
    },

    // The rating picker (a dropdown) shown before the review-text form.
    ratingPrompt: {
      content: 'How would you rate your experience? Pick a rating below to continue.',
      placeholder: 'Select a rating...',
      optionLabel: '{stars} ({rating}/{maxrating})', // {stars}, {rating}, {maxrating} are available.
    },

    embed: {
      // Small line at the very top of the embed (the embed "author").
      authorText: 'New Review! ❤️',
      useReviewerAvatarAsAuthorIcon: true,
      authorIconUrl: '', // Used only if useReviewerAvatarAsAuthorIcon is false. Leave blank for none.
      titleText: '{username} • new review', // {username} = the reviewer's display name.
      color: 'Yellow', // Fallback color, only used if colorByRating doesn't define one for the given rating.
      colorByRating: { 5: 'Green', 4: 'Green', 3: 'Yellow', 2: 'Orange', 1: 'Red' }, // Leave as {} to always use "color".
      thumbnailUrl: '', // Leave blank to use mcserver.icon.
      ratingFieldName: 'Rating',
      ratingFieldValue: '{stars} ({rating}/{maxrating})', // {stars}, {rating}, {maxrating} are available.
      showReviewedField: true,
      reviewedFieldName: 'Reviewed',
      footerText: 'ReviewHub • Review ID: {reviewid}', // {reviewid} is available.
      footerIconUrl: '', // Leave blank to use mcserver.icon.
      autoReactEmojis: [], // Emojis the bot auto-reacts with on every new review. eg: ['❤️']. Leave empty to disable.
    },

    buttons: {
      submit: { enabled: true, label: 'Submit A Review', emoji: '', style: 'Primary' }, // style: Primary, Secondary, Success, Danger.
      useful: {
        enabled: true,
        label: 'Useful',
        emoji: '👍',
        style: 'Secondary',
        showCountOnButton: false, // Shows the live useful count in the button label itself, eg. "Useful (3)".
        allowSelfVote: true, // Lets the submitter mark their own review as useful.
      },
      report: { enabled: true, label: 'Report', emoji: '🚩', style: 'Danger' },
    },

    // A thread is created and attached to every review for discussion/feedback, matching
    // the "Owner's Response" preview shown under app review embeds.
    thread: {
      enabled: true,
      name: "Owner's Response to {username}'s review", // {username} is available.
      // Auto-archive duration in minutes. Discord only accepts: 60, 1440, 4320, or 10080.
      autoArchiveMinutes: 10080,
    },

    report: {
      // Channel where report notifications are sent. Leave blank to disable staff notifications
      // (the reporter still gets an ephemeral confirmation either way).
      notifyChannelId: '',
      pingRoleIds: [], // Role IDs to ping when a review is reported.
      askForReason: true, // Shows a short form asking why the review is being reported.
      modalTitle: 'Report Review',
      reasonLabel: 'Reason (optional)',
      reasonPlaceholder: 'Why are you reporting this review?',
    },

    // Who can delete reviews via /review-delete.
    moderation: {
      allowedRoleIds: [], // Role IDs allowed to delete reviews. Leave empty to fall back below.
      // If true, members with the Administrator permission can always delete reviews,
      // even without one of the roles above.
      allowAdministrators: true,
      // If allowedRoleIds is empty and allowAdministrators is false, the Manage Server
      // permission is required as a safe fallback so this never ends up wide open by accident.
    },
  },

  commands: {
    slashCommands: true, // Enables all slash commands.
    // Channels where slash and prefix commands are enabled. eg: ['1234567','8909876',].  The number given here is channel's id.
    enabledChannels: [],
    // Channels where slash and prefix commands are disabled. eg: ['1234567','8909876',]. The number given here is channel's id.
    disabledChannels: [],
    prefixCommands: {
      enabled: true, // Enables all prefix commands.
      prefix: '!', // Prefix for normal commands.
    },
    ip: {
      enabled: true, // Enables the IP command.
      alias: ['ip-address'], // Aliases for IP prefix commands.
    },
    site: {
      enabled: true, // Enables the site command.
      alias: ['vote', 'link'], // Aliases for site prefix commands.
    },
    version: {
      enabled: true, // Enables the version command.
      alias: [], // Aliases for version prefix commands.
    },
    players: {
      enabled: true, // Enables the players command.
      alias: ['plist'], // Aliases for players prefix commands.
    },
    status: {
      enabled: true, // Enables the status command.
      alias: [], // Aliases for status prefix commands.
    },
    motd: {
      enabled: true, // Enables the motd command.
      alias: [], // Aliases for motd prefix commands.
    },
    help: {
      enabled: true, // Enables the help command.
      alias: ['commands'], // Aliases for help prefix commands.
    },
  },
}
