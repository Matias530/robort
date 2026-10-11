const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { skipTrack } = require('./play.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canción actual.'),

  async execute(interaction) {
    const ok = skipTrack(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎧 No hay ninguna canción', 'Cuando haya música sonando, podrás pasar a la siguiente.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [createResponseEmbed('⏭️ Siguiente canción', 'Listo, seguimos con la próxima de la cola.', 'success')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
