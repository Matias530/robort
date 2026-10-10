const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { skipTrack } = require('./play.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canción actual.'),

  async execute(interaction) {
    const ok = skipTrack(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        content: 'No hay ninguna canción reproduciéndose en este servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      content: 'Canción saltada.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
