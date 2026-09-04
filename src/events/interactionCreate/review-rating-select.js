const { reviews } = require('../../../config')
const { getError } = require('../../index')
const { buildSubmitModal } = require('../../review-embed')

module.exports = async (interaction) => {
  try {
    if (!interaction.isStringSelectMenu()) return
    if (interaction.customId !== 'review:rating-select') return
    if (!interaction.inGuild() || !reviews.enabled) return

    const rating = parseInt(interaction.values[0], 10)
    await interaction.showModal(buildSubmitModal(rating))
  } catch (error) {
    getError(error, 'reviewRatingSelect')
  }
}
