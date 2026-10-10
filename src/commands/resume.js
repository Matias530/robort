const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { resumePlayback } = require('./play.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reanuda la reproducción pausada.'),

  async execute(interaction) {
    const ok = resumePlayback(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        content: 'No hay ninguna canción pausada en este servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      content: 'Reproducción reanudada.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
