const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { resumePlayback, updateNowPlayingControls } = require('./play.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reanuda la reproducción pausada.'),

  async execute(interaction) {
    const ok = resumePlayback(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎶 No hay nada en pausa', 'Cuando pauses una canción, podrás retomarla desde aquí.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [createResponseEmbed('▶️ De vuelta a la música', 'La canción continúa desde donde quedó.', 'success')],
      flags: MessageFlags.Ephemeral,
    });

    await updateNowPlayingControls(interaction.guild.id);
  },
};
