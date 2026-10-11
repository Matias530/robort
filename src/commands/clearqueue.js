const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { clearUpcomingQueue } = require('./play.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Limpia la cola de reproducción futura.'),

  async execute(interaction) {
    const removed = clearUpcomingQueue(interaction.guild.id);

    if (removed === 0) {
      return interaction.reply({
        embeds: [createResponseEmbed('📭 La cola está vacía', 'No hay canciones esperando detrás de la actual.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [createResponseEmbed('🧹 Cola despejada', `Quité ${removed} ${removed === 1 ? 'canción' : 'canciones'} pendientes. La que está sonando sigue igual.`, 'success')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
