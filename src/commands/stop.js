const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { stopPlayback } = require('./play.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la reproducción y limpia la cola.'),

  async execute(interaction) {
    const ok = stopPlayback(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        content: 'No hay ninguna reproducción activa en este servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      content: 'La reproducción fue detenida y la cola fue limpiada.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
