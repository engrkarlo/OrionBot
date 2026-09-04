const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js')
const { cmdSlashTranslation, isChannelAllowed, getError } = require('../index')
const { mcserver, settings } = require('../../config')
const chalk = require('chalk')
const fs = require('fs')

module.exports = {
  data: new SlashCommandBuilder()
    .setName(cmdSlashTranslation.setup.name)
    .setDescription(cmdSlashTranslation.setup.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName(cmdSlashTranslation.setup.subServer.name)
        .setDescription(cmdSlashTranslation.setup.subServer.description)
        .addStringOption((option) =>
          option.setName('ip').setDescription(cmdSlashTranslation.setup.optionIp).setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription(cmdSlashTranslation.setup.optionType)
            .setRequired(true)
            .addChoices({ name: 'Java', value: 'java' }, { name: 'Bedrock', value: 'bedrock' })
        )
        .addIntegerOption((option) =>
          option
            .setName('port')
            .setDescription(cmdSlashTranslation.setup.optionPort)
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(65535)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription(cmdSlashTranslation.setup.optionName).setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('version').setDescription(cmdSlashTranslation.setup.optionVersion).setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName(cmdSlashTranslation.setup.subView.name)
        .setDescription(cmdSlashTranslation.setup.subView.description)
    )
    .addSubcommand((sub) =>
      sub
        .setName(cmdSlashTranslation.setup.subReset.name)
        .setDescription(cmdSlashTranslation.setup.subReset.description)
    )
    .addSubcommand((sub) =>
      sub
        .setName(cmdSlashTranslation.setup.subIcon.name)
        .setDescription(cmdSlashTranslation.setup.subIcon.description)
        .addStringOption((option) =>
          option.setName('url').setDescription(cmdSlashTranslation.setup.optionIconUrl).setRequired(true)
        )
    ),

  run: async ({ interaction }) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      if (!isChannelAllowed(interaction.channelId, false)) {
        await interaction.editReply({
          content: cmdSlashTranslation.disabledChannelMsg,
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const subcommand = interaction.options.getSubcommand()

      // ── /setup view ────────────────────────────────────────────────────────
      if (subcommand === cmdSlashTranslation.setup.subView.name) {
        const rawData = fs.readFileSync('./src/data.json', 'utf8')
        const savedData = JSON.parse(rawData)
        const isSaved = !!savedData.serverConfig

        const embed = new EmbedBuilder()
          .setColor(settings.embedsColors.basicCmds)
          .setTitle(cmdSlashTranslation.setup.viewTitle)
          .setDescription(
            isSaved
              ? cmdSlashTranslation.setup.viewDescSaved
              : cmdSlashTranslation.setup.viewDescDefault
          )
          .addFields(
            { name: cmdSlashTranslation.setup.fieldName, value: `\`${mcserver.name}\``, inline: true },
            { name: cmdSlashTranslation.setup.fieldIp, value: `\`${mcserver.ip}\``, inline: true },
            { name: cmdSlashTranslation.setup.fieldPort, value: `\`${mcserver.port}\``, inline: true },
            { name: cmdSlashTranslation.setup.fieldType, value: `\`${mcserver.type}\``, inline: true },
            { name: cmdSlashTranslation.setup.fieldVersion, value: `\`${mcserver.version}\``, inline: true }
          )
          .setTimestamp()

        await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        return
      }

      // ── /setup reset ───────────────────────────────────────────────────────
      if (subcommand === cmdSlashTranslation.setup.subReset.name) {
        const rawData = fs.readFileSync('./src/data.json', 'utf8')
        const data = JSON.parse(rawData)

        if (!data.serverConfig) {
          await interaction.editReply({
            content: cmdSlashTranslation.setup.resetNoop,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        data.serverConfig = null
        fs.writeFileSync('./src/data.json', JSON.stringify(data, null, 2), 'utf8')

        const defaults = require('../../config').mcserver
        mcserver.ip = defaults.ip
        mcserver.port = defaults.port
        mcserver.type = defaults.type
        mcserver.name = defaults.name
        mcserver.version = defaults.version

        await interaction.editReply({
          content: cmdSlashTranslation.setup.resetSuccess,
          flags: MessageFlags.Ephemeral,
        })

        console.log(
          `${chalk.gray(new Date().toLocaleTimeString())} | ${chalk.cyan('SETUP')} | Server config reset to config.js defaults (${chalk.cyan(mcserver.ip)})`
        )
        return
      }

      // ── /setup icon ────────────────────────────────────────────────────────
      if (subcommand === cmdSlashTranslation.setup.subIcon.name) {
        const url = interaction.options.getString('url')

        if (!/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)) {
          await interaction.editReply({
            content: cmdSlashTranslation.setup.iconInvalidUrl,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        mcserver.icon = url

        const rawData = fs.readFileSync('./src/data.json', 'utf8')
        const data = JSON.parse(rawData)
        if (!data.serverConfig) data.serverConfig = {}
        data.serverConfig.icon = url
        fs.writeFileSync('./src/data.json', JSON.stringify(data, null, 2), 'utf8')

        const embed = new EmbedBuilder()
          .setColor(settings.embedsColors.online)
          .setTitle(cmdSlashTranslation.setup.iconSuccessTitle)
          .setDescription(cmdSlashTranslation.setup.iconSuccessDesc)
          .setThumbnail(url)
          .setTimestamp()

        await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral })

        console.log(
          `${chalk.gray(new Date().toLocaleTimeString())} | ${chalk.cyan('SETUP')} | Server icon updated to ${chalk.cyan(url)}`
        )
        return
      }

      // ── /setup server ──────────────────────────────────────────────────────
      const ip = interaction.options.getString('ip')
      const type = interaction.options.getString('type')
      const port = interaction.options.getInteger('port') ?? (type === 'bedrock' ? 19132 : 25565)
      const name = interaction.options.getString('name') || ip
      const version = interaction.options.getString('version') || mcserver.version

      if (!ip.includes('.')) {
        await interaction.editReply({
          content: cmdSlashTranslation.setup.invalidIp.replace(/\{ip\}/gi, ip),
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const serverConfig = { ip, port, type, name, version }

      mcserver.ip = ip
      mcserver.port = port
      mcserver.type = type
      mcserver.name = name
      mcserver.version = version

      const rawData = fs.readFileSync('./src/data.json', 'utf8')
      const data = JSON.parse(rawData)
      data.serverConfig = serverConfig
      fs.writeFileSync('./src/data.json', JSON.stringify(data, null, 2), 'utf8')

      const embed = new EmbedBuilder()
        .setColor(settings.embedsColors.online)
        .setTitle(cmdSlashTranslation.setup.successTitle)
        .addFields(
          { name: cmdSlashTranslation.setup.fieldName, value: `\`${name}\``, inline: true },
          { name: cmdSlashTranslation.setup.fieldIp, value: `\`${ip}\``, inline: true },
          { name: cmdSlashTranslation.setup.fieldPort, value: `\`${port}\``, inline: true },
          { name: cmdSlashTranslation.setup.fieldType, value: `\`${type}\``, inline: true },
          { name: cmdSlashTranslation.setup.fieldVersion, value: `\`${version}\``, inline: true }
        )
        .setTimestamp()

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral })

      console.log(
        `${chalk.gray(new Date().toLocaleTimeString())} | ${chalk.cyan('SETUP')} | Server config updated to ${chalk.bold(name)} (${chalk.cyan(ip)}:${chalk.cyan(port)}) [${chalk.yellow(type)}]`
      )
    } catch (error) {
      await interaction.editReply({
        content: cmdSlashTranslation.setup.errorReply.replace(/\{error\}/gi, error.message),
        flags: MessageFlags.Ephemeral,
      })
      getError(error, 'setup')
    }
  },

  options: {
    deleted: false,
  },
}
