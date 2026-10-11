const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { pausePlayback, updateNowPlayingControls } = require('./play.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la reproducción actual.'),

  async execute(interaction) {
    const ok = pausePlayback(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎧 No hay nada sonando', 'Agrega una canción con `/play` y la pausamos cuando quieras.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [createResponseEmbed('⏸️ En pausa', 'La canción quedó en pausa. Puedes retomarla cuando quieras.', 'success')],
      flags: MessageFlags.Ephemeral,
    });

    await updateNowPlayingControls(interaction.guild.id);
  },
};
