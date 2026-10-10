const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { pausePlayback } = require('./play.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la reproducción actual.'),

  async execute(interaction) {
    const ok = pausePlayback(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        content: 'No hay ninguna canción reproducciéndose en este servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      content: 'Reproducción pausada.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
