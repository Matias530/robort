const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { toggleLoop, updateNowPlayingControls } = require('./play.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Activa o desactiva el bucle de la canción actual.'),

  async execute(interaction) {
    const enabled = toggleLoop(interaction.guild.id);

    if (enabled === null) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎧 No hay ninguna canción', 'Pon música primero y después podrás repetirla.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [createResponseEmbed(
        enabled ? '🔁 Repetición activada' : '➡️ Repetición desactivada',
        enabled ? 'Esta canción seguirá sonando hasta que apagues la repetición.' : 'Al terminar esta canción, sigue la cola.',
        'success',
      )],
      flags: MessageFlags.Ephemeral,
    });

    await updateNowPlayingControls(interaction.guild.id);
  },
};