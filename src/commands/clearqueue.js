const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { clearUpcomingQueue } = require('./play.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Limpia la cola de reproducción futura.'),

  async execute(interaction) {
    const removed = clearUpcomingQueue(interaction.guild.id);

    if (removed === 0) {
      return interaction.reply({
        content: 'No hay canciones pendientes en la cola.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      content: `Se eliminaron ${removed} canciones de la cola.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
