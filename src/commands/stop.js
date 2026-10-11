const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { stopPlayback } = require('./play.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la reproducción y limpia la cola.'),

  async execute(interaction) {
    const ok = stopPlayback(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎵 No hay música activa', 'Cuando quieras escuchar algo, prueba `/play`.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [createResponseEmbed('⏹️ Música detenida', 'Paré la canción y dejé la cola vacía.', 'success')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
