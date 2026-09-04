const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js')
const { reviews, mcserver } = require('../config')
const { canSubmit, getActiveReviewByAuthor } = require('./reviews')

const BUTTON_STYLES = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
}

const resolveButtonStyle = (style) => BUTTON_STYLES[style] || ButtonStyle.Secondary

// Clamps a rating to the configured min/max, rounding and falling back to the max on
// anything that isn't a number (e.g. a corrupted/missing value).
const clampRating = (rating) => {
  const { min, max } = reviews.rating
  const n = Number(rating)
  if (Number.isNaN(n)) return max
  return Math.min(max, Math.max(min, Math.round(n)))
}

const buildStars = (rating) => {
  const { min, max, filledEmoji, emptyEmoji } = reviews.rating
  const r = clampRating(rating)
  const filled = (filledEmoji || '⭐').repeat(Math.max(0, r - min + 1))
  const empty = emptyEmoji ? emptyEmoji.repeat(Math.max(0, max - r)) : ''
  return filled + empty
}

// ── Panel (the sticky "Submit A Review" embed posted by /review-panel) ────────

const buildPanelEmbed = (guild) => {
  const cfg = reviews.panel
  const embed = new EmbedBuilder()
    .setColor(cfg.color || 'Blurple')
    .setTitle(cfg.title || 'ReviewHub')
    .setDescription((cfg.description || '').replace(/\{server\}/gi, mcserver.name))

  const thumbnail = cfg.thumbnailUrl || mcserver.icon || guild?.iconURL?.()
  if (thumbnail) embed.setThumbnail(thumbnail)

  if (cfg.footerText) {
    embed.setFooter({ text: cfg.footerText, iconURL: cfg.footerIconUrl || mcserver.icon || undefined })
  }

  return embed
}

const buildPanelComponents = () => {
  const cfg = reviews.buttons.submit
  if (!cfg.enabled) return []
  const button = new ButtonBuilder().setCustomId('review:submit').setLabel(cfg.label).setStyle(resolveButtonStyle(cfg.style))
  if (cfg.emoji) button.setEmoji(cfg.emoji)
  return [new ActionRowBuilder().addComponents(button)]
}

// ── Review embed (posted once a member finishes the submit flow) ──────────────

// Builds the review embed. `submitter` can be a GuildMember or a User — both expose
// displayAvatarURL(), which is all this needs.
const buildReviewEmbed = (review, { guild, submitter } = {}) => {
  const cfg = reviews.embed
  const rating = clampRating(review.rating)
  const stars = buildStars(rating)
  const color = (cfg.colorByRating && cfg.colorByRating[rating]) || cfg.color || 'Yellow'
  const username = submitter?.displayName || submitter?.user?.username || submitter?.username || 'Unknown'

  const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(review.content.slice(0, 4096))
    .addFields({
      name: cfg.ratingFieldName || 'Rating',
      value: (cfg.ratingFieldValue || '{stars} ({rating}/{maxrating})')
        .replace(/\{stars\}/gi, stars)
        .replace(/\{rating\}/gi, rating)
        .replace(/\{maxrating\}/gi, reviews.rating.max),
      inline: true,
    })

  if (cfg.showReviewedField) {
    embed.addFields({
      name: cfg.reviewedFieldName || 'Reviewed',
      value: `<t:${Math.floor(review.createdAt / 1000)}:R>`,
      inline: true,
    })
  }

  if (cfg.authorText) {
    const authorIcon = cfg.useReviewerAvatarAsAuthorIcon ? submitter?.displayAvatarURL?.() : cfg.authorIconUrl || undefined
    embed.setAuthor({ name: cfg.authorText, iconURL: authorIcon || undefined })
  }

  const titleText = (cfg.titleText || '{username} • new review').replace(/\{username\}/gi, username)
  if (titleText) embed.setTitle(titleText.slice(0, 256))

  const thumbnail = cfg.thumbnailUrl || mcserver.icon || guild?.iconURL?.()
  if (thumbnail) embed.setThumbnail(thumbnail)

  const footerText = (cfg.footerText || '').replace(/\{reviewid\}/gi, review.reviewId)
  if (footerText) {
    embed.setFooter({ text: footerText, iconURL: cfg.footerIconUrl || mcserver.icon || undefined })
  }

  return embed
}

// Builds the button row for a review: Report / Submit A Review / Useful, each individually
// toggleable and styleable from config.
const buildReviewComponents = (review) => {
  const cfg = reviews.buttons
  const components = []

  if (cfg.report.enabled) {
    const button = new ButtonBuilder().setCustomId('review:report').setLabel(cfg.report.label).setStyle(resolveButtonStyle(cfg.report.style))
    if (cfg.report.emoji) button.setEmoji(cfg.report.emoji)
    components.push(button)
  }

  if (cfg.submit.enabled) {
    const button = new ButtonBuilder().setCustomId('review:submit').setLabel(cfg.submit.label).setStyle(resolveButtonStyle(cfg.submit.style))
    if (cfg.submit.emoji) button.setEmoji(cfg.submit.emoji)
    components.push(button)
  }

  if (cfg.useful.enabled) {
    const label = cfg.useful.showCountOnButton ? `${cfg.useful.label} (${review.usefulVoters.length})` : cfg.useful.label
    const button = new ButtonBuilder().setCustomId('review:useful').setLabel(label).setStyle(resolveButtonStyle(cfg.useful.style))
    if (cfg.useful.emoji) button.setEmoji(cfg.useful.emoji)
    components.push(button)
  }

  if (!components.length) return []
  return [new ActionRowBuilder().addComponents(components)]
}

// ── Submission flow: rating select menu -> review-text modal ──────────────────

// Discord select menus allow at most 25 options — clamp so a very wide configured rating
// range (e.g. 1-100) can never break the picker.
const buildRatingSelectRow = () => {
  const cfg = reviews.ratingPrompt
  const min = reviews.rating.min
  const max = reviews.rating.max - reviews.rating.min + 1 > 25 ? reviews.rating.min + 24 : reviews.rating.max

  const options = []
  for (let r = max; r >= min; r--) {
    options.push({
      label: (cfg.optionLabel || '{stars} ({rating}/{maxrating})')
        .replace(/\{stars\}/gi, buildStars(r))
        .replace(/\{rating\}/gi, r)
        .replace(/\{maxrating\}/gi, reviews.rating.max)
        .slice(0, 100),
      value: String(r),
    })
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('review:rating-select')
    .setPlaceholder(cfg.placeholder || 'Select a rating...')
    .addOptions(options)

  return new ActionRowBuilder().addComponents(select)
}

const buildSubmitModal = (rating) => {
  const cfg = reviews.modal
  const minLength = Math.min(Math.max(1, reviews.minLength || 1), 4000)
  const maxLength = Math.min(4000, Math.max(minLength, reviews.maxLength || 800))

  const modal = new ModalBuilder().setCustomId(`review-submit-modal:${rating}`).setTitle((cfg.title || 'Submit A Review').slice(0, 45))

  const reviewInput = new TextInputBuilder()
    .setCustomId('review-content')
    .setLabel((cfg.reviewLabel || 'Your review').slice(0, 45))
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder((cfg.reviewPlaceholder || '').slice(0, 100))
    .setMinLength(minLength)
    .setMaxLength(maxLength)
    .setRequired(true)

  modal.addComponents(new ActionRowBuilder().addComponents(reviewInput))
  return modal
}

const buildReportModal = () => {
  const cfg = reviews.report
  const modal = new ModalBuilder().setCustomId('review-report-modal').setTitle((cfg.modalTitle || 'Report Review').slice(0, 45))

  const reasonInput = new TextInputBuilder()
    .setCustomId('review-report-reason')
    .setLabel((cfg.reasonLabel || 'Reason (optional)').slice(0, 45))
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder((cfg.reasonPlaceholder || '').slice(0, 100))
    .setMaxLength(300)
    .setRequired(false)

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput))
  return modal
}

// Shared entry point for starting a submission — used by both the /review command and the
// "Submit A Review" button (whether clicked on the panel or on an existing review card).
// Replies to the interaction itself, so the caller just awaits and returns.
const startReviewSubmission = async (interaction) => {
  if (!canSubmit(interaction.member)) {
    await interaction.reply({ content: 'You do not have permission to submit reviews.', flags: MessageFlags.Ephemeral })
    return
  }

  if (reviews.submitting.oncePerUser && getActiveReviewByAuthor(interaction.guildId, interaction.user.id)) {
    await interaction.reply({
      content: reviews.submitting.oncePerUserMessage || "You've already submitted a review.",
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.reply({
    content: reviews.ratingPrompt.content || 'How would you rate your experience?',
    components: [buildRatingSelectRow()],
    flags: MessageFlags.Ephemeral,
  })
}

module.exports = {
  buildStars,
  buildPanelEmbed,
  buildPanelComponents,
  buildReviewEmbed,
  buildReviewComponents,
  buildRatingSelectRow,
  buildSubmitModal,
  buildReportModal,
  startReviewSubmission,
}
